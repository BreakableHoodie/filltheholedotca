import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { recordAuthAttempt } from '$lib/server/admin-auth';
import { hashPassword } from '$lib/server/admin-crypto';
import { hashIp } from '$lib/hash';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Load: validate invite code from URL, pre-populate email if restricted
// ---------------------------------------------------------------------------
export const load: PageServerLoad = async ({ url, locals }) => {
	// Logged-in admins shouldn't use invite codes
	if (locals.adminUser) throw redirect(302, '/admin/photos');

	const code = url.searchParams.get('code')?.trim() ?? '';
	if (!code) return { invite: null, error: 'No invite code provided.' };

	const { data: invite } = await adminSupabase
		.from('admin_invite_codes')
		.select('id, code, email, role, expires_at, is_active, used_at')
		.eq('code', code)
		.maybeSingle();

	const invalid =
		!invite ||
		!invite.is_active ||
		invite.used_at !== null ||
		new Date(invite.expires_at) < new Date();

	if (invalid) return { invite: null, error: 'This invite link is invalid or has expired.' };

	return { invite: { code: invite.code, email: invite.email, role: invite.role as string } };
};

// ---------------------------------------------------------------------------
// Action: validate invite, create user (inactive), mark invite used
// ---------------------------------------------------------------------------
export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const fd = await request.formData();
		const code = fd.get('code')?.toString().trim() ?? '';
		const email = fd.get('email')?.toString().trim().toLowerCase() ?? '';
		const firstName = fd.get('firstName')?.toString().trim() ?? '';
		const lastName = fd.get('lastName')?.toString().trim() ?? '';
		const password = fd.get('password')?.toString() ?? '';
		const confirmPassword = fd.get('confirmPassword')?.toString() ?? '';

		const echo = { email, firstName, lastName, code };

		// Basic field validation
		const fieldsParsed = z
			.object({
				email: z.string().email().max(255),
				firstName: z.string().min(1).max(100),
				lastName: z.string().min(1).max(100),
				password: z.string().min(12).max(128)
			})
			.safeParse({ email, firstName, lastName, password });

		if (!fieldsParsed.success)
			return fail(400, { error: fieldsParsed.error.issues[0]?.message ?? 'Invalid input', ...echo });

		if (password !== confirmPassword)
			return fail(400, { error: 'Passwords do not match', ...echo });

		// Re-validate invite (never trust hidden field — re-fetch from DB)
		const { data: invite } = await adminSupabase
			.from('admin_invite_codes')
			.select('id, email, role, expires_at, is_active, used_at')
			.eq('code', code)
			.maybeSingle();

		const invalid =
			!invite ||
			!invite.is_active ||
			invite.used_at !== null ||
			new Date(invite.expires_at) < new Date();

		if (invalid) return fail(400, { error: 'Invalid or expired invite code', ...echo });

		// If invite is email-restricted, enforce it
		if (invite.email && invite.email.toLowerCase() !== email)
			return fail(400, { error: 'Email does not match this invite', ...echo });

		// Check email uniqueness
		const { data: existing } = await adminSupabase
			.from('admin_users')
			.select('id')
			.eq('email', email)
			.maybeSingle();

		if (existing) return fail(400, { error: 'An account with that email already exists', ...echo });

		// Create user — role always from invite, never from request body
		const passwordHash = await hashPassword(password);
		const { data: newUser, error: insertError } = await adminSupabase
			.from('admin_users')
			.insert({
				email,
				password_hash: passwordHash,
				first_name: firstName,
				last_name: lastName,
				role: invite.role,
				is_active: false // admin must activate before user can log in
			})
			.select('id')
			.single();

		if (insertError || !newUser)
			return fail(500, { error: 'Failed to create account. Please try again.', ...echo });

		// Mark invite as used (atomic — if this fails the user is still created but can't be activated cleanly)
		await adminSupabase
			.from('admin_invite_codes')
			.update({ used_by: newUser.id, used_at: new Date().toISOString(), is_active: false })
			.eq('id', invite.id);

		await recordAuthAttempt({
			userId: newUser.id,
			email,
			ipHash: await hashIp(getClientAddress()),
			userAgent: '',
			attemptType: 'signup',
			success: true
		});

		return { registered: true };
	}
};
