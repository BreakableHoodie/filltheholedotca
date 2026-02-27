import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { SESSION_COOKIE, writeAuditLog } from '$lib/server/admin-auth';
import { hashIp } from '$lib/hash';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');

	const currentSessionId = cookies.get(SESSION_COOKIE) ?? null;

	const { data: sessions } = await adminSupabase
		.from('admin_sessions')
		.select('id, created_at, last_activity_at, ip_address, user_agent, expires_at')
		.eq('user_id', locals.adminUser.id)
		.gt('expires_at', new Date().toISOString())
		.order('last_activity_at', { ascending: false });

	return {
		sessions: (sessions ?? []).map((s) => ({ ...s, isCurrent: s.id === currentSessionId })),
		hasOtherSessions: (sessions ?? []).some((s) => s.id !== currentSessionId)
	};
};

export const actions: Actions = {
	// Revoke all sessions except the current one
	revokeOthers: async ({ locals, cookies, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');

		const currentSessionId = cookies.get(SESSION_COOKIE) ?? null;
		if (!currentSessionId) return fail(400, { error: 'Cannot determine current session' });

		let query = adminSupabase.from('admin_sessions').delete().eq('user_id', locals.adminUser.id);
		query = query.neq('id', currentSessionId);
		await query;

		await writeAuditLog(
			locals.adminUser.id,
			'user.sessions_revoked_others',
			'user',
			locals.adminUser.id,
			null,
			await hashIp(getClientAddress())
		);

		return { success: true };
	}
};
