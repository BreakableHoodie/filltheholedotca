import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireRole, writeAuditLog, invalidateAllSessionsForUser } from '$lib/server/admin-auth';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const uuidSchema = z.string().uuid();

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'admin');

	const [usersRes, sessionsRes] = await Promise.all([
		adminSupabase
			.from('admin_users')
			.select(
				'id, email, first_name, last_name, role, is_active, activated_at, last_login_at, totp_enabled, created_at'
			)
			.order('created_at', { ascending: true }),
		adminSupabase
			.from('admin_sessions')
			.select('user_id')
			.gt('expires_at', new Date().toISOString())
	]);

	// Count active sessions per user
	const sessionCounts = (sessionsRes.data ?? []).reduce<Record<string, number>>((acc, s) => {
		acc[s.user_id] = (acc[s.user_id] ?? 0) + 1;
		return acc;
	}, {});

	return {
		users: (usersRes.data ?? []).map((u) => ({
			...u,
			activeSessions: sessionCounts[u.id] ?? 0
		})),
		currentUserId: locals.adminUser.id
	};
};

// ---------------------------------------------------------------------------
// Form actions — all admin-only
// ---------------------------------------------------------------------------

export const actions: Actions = {
	changeRole: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'admin');

		const fd = await request.formData();
		const userId = fd.get('userId')?.toString() ?? '';
		const role = fd.get('role')?.toString() ?? '';

		if (!uuidSchema.safeParse(userId).success) return fail(400, { error: 'Invalid user ID' });
		if (userId === locals.adminUser.id) return fail(400, { error: 'Cannot change your own role' });

		const roleParsed = z.enum(['admin', 'editor', 'viewer']).safeParse(role);
		if (!roleParsed.success) return fail(400, { error: 'Invalid role' });

		const { error: dbErr } = await adminSupabase
			.from('admin_users')
			.update({ role: roleParsed.data })
			.eq('id', userId);
		if (dbErr) return fail(500, { error: 'Failed to update role' });

		await writeAuditLog(
			locals.adminUser.id,
			'user.role_change',
			'user',
			userId,
			{ role: roleParsed.data },
			getClientAddress()
		);
		return { success: true };
	},

	activate: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'admin');

		const fd = await request.formData();
		const userId = fd.get('userId')?.toString() ?? '';
		if (!uuidSchema.safeParse(userId).success) return fail(400, { error: 'Invalid user ID' });

		const { error: dbErr } = await adminSupabase
			.from('admin_users')
			.update({ is_active: true, activated_at: new Date().toISOString() })
			.eq('id', userId);
		if (dbErr) return fail(500, { error: 'Failed to activate user' });

		await writeAuditLog(
			locals.adminUser.id,
			'user.activate',
			'user',
			userId,
			null,
			getClientAddress()
		);
		return { success: true };
	},

	deactivate: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'admin');

		const fd = await request.formData();
		const userId = fd.get('userId')?.toString() ?? '';
		if (!uuidSchema.safeParse(userId).success) return fail(400, { error: 'Invalid user ID' });
		if (userId === locals.adminUser.id)
			return fail(400, { error: 'Cannot deactivate your own account' });

		const { error: dbErr } = await adminSupabase
			.from('admin_users')
			.update({ is_active: false })
			.eq('id', userId);
		if (dbErr) return fail(500, { error: 'Failed to deactivate user' });

		// Immediately revoke all their sessions
		await invalidateAllSessionsForUser(userId);

		await writeAuditLog(
			locals.adminUser.id,
			'user.deactivate',
			'user',
			userId,
			null,
			getClientAddress()
		);
		return { success: true };
	},

	revokeAll: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'admin');

		const fd = await request.formData();
		const userId = fd.get('userId')?.toString() ?? '';
		if (!uuidSchema.safeParse(userId).success) return fail(400, { error: 'Invalid user ID' });

		await invalidateAllSessionsForUser(userId);

		await writeAuditLog(
			locals.adminUser.id,
			'user.sessions_revoked',
			'user',
			userId,
			null,
			getClientAddress()
		);
		return { success: true };
	}
};
