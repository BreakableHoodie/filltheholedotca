import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { writeAuditLog } from '$lib/server/admin-auth';
import { hashPassword, verifyPassword } from '$lib/server/admin-crypto';
import { hashIp } from '$lib/hash';

function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');

		const fd = await request.formData();
		const current = fd.get('current')?.toString() ?? '';
		const next = fd.get('password')?.toString() ?? '';
		const confirm = fd.get('confirm')?.toString() ?? '';

		if (!current) return fail(400, { error: 'Enter your current password' });
		if (next !== confirm) return fail(400, { error: 'New passwords do not match' });

		const nextParsed = z
			.string()
			.min(12, 'Password must be at least 12 characters')
			.max(128, 'Password must be at most 128 characters')
			.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
			.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
			.regex(/[0-9]/, 'Password must contain at least one number')
			.regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
			.safeParse(next);
		if (!nextParsed.success)
			return fail(400, { error: nextParsed.error.issues[0]?.message ?? 'Invalid password' });

		// Fetch stored hash
		const { data: user } = await getAdminClient()
			.from('admin_users')
			.select('password_hash')
			.eq('id', locals.adminUser.id)
			.single();

		if (!user?.password_hash) return fail(500, { error: 'Unable to verify current password' });

		const ok = await verifyPassword(current, user.password_hash);
		if (!ok) return fail(400, { error: 'Current password is incorrect' });

		const newHash = await hashPassword(next);
		const { error: dbErr } = await getAdminClient()
			.from('admin_users')
			.update({ password_hash: newHash })
			.eq('id', locals.adminUser.id);

		if (dbErr) return fail(500, { error: 'Failed to update password' });

		await writeAuditLog(
			locals.adminUser.id,
			'user.password_changed',
			'user',
			locals.adminUser.id,
			null,
			await hashIp(getClientAddress())
		);

		return { success: true };
	}
};
