import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type InviteRow = {
	id: string;
	code: string;
	email: string | null;
	role: string;
	is_active: boolean;
	created_at: string;
	expires_at: string;
	used_at: string | null;
	creator: { first_name: string; last_name: string } | null;
	used_by_user: { first_name: string; last_name: string; email: string } | null;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'admin');

	const { data } = await adminSupabase
		.from('admin_invite_codes')
		.select(
			`id, code, email, role, is_active, created_at, expires_at, used_at,
       creator:created_by ( first_name, last_name ),
       used_by_user:used_by ( first_name, last_name, email )`
		)
		.order('created_at', { ascending: false });

	return {
		invites: (data ?? []) as unknown as InviteRow[],
		origin: url.origin
	};
};

// ---------------------------------------------------------------------------
// Form actions — all admin-only
// ---------------------------------------------------------------------------

export const actions: Actions = {
	createInvite: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'admin');

		const fd = await request.formData();
		const emailRaw = fd.get('email')?.toString().trim() || null;
		const role = fd.get('role')?.toString() ?? '';

		// Optional email restriction
		if (emailRaw) {
			const emailParsed = z.string().email().max(255).safeParse(emailRaw);
			if (!emailParsed.success) return fail(400, { error: 'Invalid email address' });
		}

		const roleParsed = z.enum(['admin', 'editor', 'viewer']).safeParse(role);
		if (!roleParsed.success) return fail(400, { error: 'Invalid role' });

		const code = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

		const { error: dbErr } = await adminSupabase.from('admin_invite_codes').insert({
			code,
			email: emailRaw ?? null,
			role: roleParsed.data,
			created_by: locals.adminUser.id,
			expires_at: expiresAt,
			is_active: true
		});

		if (dbErr) return fail(500, { error: 'Failed to create invite' });

		await writeAuditLog(
			locals.adminUser.id,
			'invite.create',
			'invite',
			null,
			{ role: roleParsed.data },
			getClientAddress()
		);
		return { success: true };
	},

	deactivateInvite: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'admin');

		const id = (await request.formData()).get('id')?.toString() ?? '';
		if (!z.string().uuid().safeParse(id).success) return fail(400, { error: 'Invalid ID' });

		const { error: dbErr } = await adminSupabase
			.from('admin_invite_codes')
			.update({ is_active: false })
			.eq('id', id);
		if (dbErr) return fail(500, { error: 'Failed to deactivate invite' });

		await writeAuditLog(
			locals.adminUser.id,
			'invite.deactivate',
			'invite',
			id,
			null,
			getClientAddress()
		);
		return { success: true };
	}
};
