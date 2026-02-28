import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { checkAuthRateLimit, recordAuthAttempt } from '$lib/server/admin-auth';
import { hashPassword } from '$lib/server/admin-crypto';
import { hashIp } from '$lib/hash';

function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const signupSchema = z.object({
	inviteCode: z.string().min(1),
	email: z.string().email().toLowerCase(),
	password: z
		.string()
		.min(12, 'Password must be at least 12 characters')
		.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
		.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
		.regex(/[0-9]/, 'Password must contain at least one number')
		.regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
	firstName: z.string().trim().min(1).max(100),
	lastName: z.string().trim().min(1).max(100)
});

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = signupSchema.safeParse(raw);
	if (!parsed.success) {
		const message = parsed.error.issues[0]?.message ?? 'Invalid signup data';
		throw error(400, message);
	}

	const { inviteCode, email, password, firstName, lastName } = parsed.data;
	const ipHash = await hashIp(getClientAddress());
	const userAgent = request.headers.get('user-agent') ?? 'unknown';

	// Rate limit
	const rateCheck = await checkAuthRateLimit(email, ipHash, 'signup');
	if (!rateCheck.allowed) {
		throw error(
			429,
			`Too many signup attempts. Try again in ${rateCheck.remainingMinutes} minutes.`
		);
	}

	// Validate invite code
	const { data: invite } = await getAdminClient()
		.from('admin_invite_codes')
		.select('id, email, role')
		.eq('code', inviteCode)
		.eq('is_active', true)
		.is('used_by', null)
		.gt('expires_at', new Date().toISOString())
		.maybeSingle();

	if (!invite) {
		await recordAuthAttempt({
			email,
			ipHash,
			userAgent,
			attemptType: 'signup',
			success: false,
			failureReason: 'invalid_invite_code'
		});
		throw error(403, 'Invite code is invalid, expired, or already used');
	}

	// If email-restricted, enforce it
	if (invite.email && invite.email.toLowerCase() !== email) {
		await recordAuthAttempt({
			email,
			ipHash,
			userAgent,
			attemptType: 'signup',
			success: false,
			failureReason: 'email_mismatch'
		});
		throw error(403, 'This invite code is restricted to a different email address');
	}

	// SECURITY: role always comes from the invite record, never from the request body
	const userRole = invite.role;

	// Check for existing account
	const { data: existing } = await getAdminClient()
		.from('admin_users')
		.select('id')
		.eq('email', email)
		.maybeSingle();

	if (existing) throw error(409, 'An account with that email already exists');

	const passwordHash = await hashPassword(password);

	// Create user (inactive until activated via link logged to console / sent by email)
	const { data: newUser, error: insertError } = await getAdminClient()
		.from('admin_users')
		.insert({
			email,
			password_hash: passwordHash,
			first_name: firstName,
			last_name: lastName,
			role: userRole,
			is_active: false
		})
		.select('id, email, role')
		.single();

	if (insertError || !newUser) {
		console.error('[signup] Insert failed:', insertError);
		throw error(500, 'Failed to create account');
	}

	// Atomically mark invite as used — the .is('used_at', null) guard ensures only one
	// concurrent signup wins even if two requests arrive with the same valid code.
	const { data: consumed } = await getAdminClient()
		.from('admin_invite_codes')
		.update({ used_by: newUser.id, used_at: new Date().toISOString() })
		.eq('id', invite.id)
		.is('used_at', null)
		.select('id');

	if (!consumed || consumed.length === 0) {
		// Another concurrent request consumed the invite first — roll back the created user.
		await getAdminClient().from('admin_users').delete().eq('id', newUser.id);
		throw error(409, 'This invite code has already been used');
	}

	await recordAuthAttempt({
		userId: newUser.id,
		email,
		ipHash,
		userAgent,
		attemptType: 'signup',
		success: true
	});

	// TODO: send activation email when SMTP is configured.
	// For now, an admin must manually set is_active = true and activated_at = now() in Supabase.
	console.info(
		`[signup] New admin account created: ${email} (role: ${userRole}). ` +
			`Activate via Supabase dashboard: UPDATE admin_users SET is_active = true, activated_at = now() WHERE id = '${newUser.id}';`
	);

	return json({
		ok: true,
		message: 'Account created. Contact your administrator to activate it.',
		requiresActivation: true
	});
};
