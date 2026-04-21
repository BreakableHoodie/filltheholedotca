import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';
import { hashIp } from '$lib/hash';
import { getAdminClient } from '$lib/server/supabase';
const BOOLEAN_SETTING = z.enum(['true', 'false']);

const SETTING_SCHEMAS: Record<string, z.ZodTypeAny> = {
	confirmation_threshold: z.coerce.number().int().min(1).max(20),
	pushover_enabled: BOOLEAN_SETTING,
	pushover_notify_photos: BOOLEAN_SETTING,
	pushover_notify_community: BOOLEAN_SETTING,
	pushover_notify_security: BOOLEAN_SETTING
};

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'admin');

	const { data, error: dbErr } = await getAdminClient()
		.from('site_settings')
		.select('key, value, updated_at')
		.order('key');

	if (dbErr) throw error(500, 'Failed to load settings');

	return {
		settings: Object.fromEntries((data ?? []).map((s) => [s.key, s]))
	};
};

export const actions: Actions = {
	updateSetting: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'admin');

		const fd = await request.formData();
		const key = fd.get('key')?.toString() ?? '';
		const value = fd.get('value')?.toString() ?? '';

		const schema = SETTING_SCHEMAS[key];
		if (!schema) return fail(400, { error: `Unknown setting: ${key}` });

		const parsed = schema.safeParse(value);
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid value' });

		const { error: dbErr } = await getAdminClient()
			.from('site_settings')
			.upsert({ key, value: String(parsed.data), updated_at: new Date().toISOString() });

		if (dbErr) return fail(500, { error: 'Failed to save setting' });

		await writeAuditLog(
			locals.adminUser.id,
			'settings.update',
			'site_settings',
			key,
			{ value: String(parsed.data) },
			await hashIp(getClientAddress())
		);

		return { success: true, key };
	}
};
