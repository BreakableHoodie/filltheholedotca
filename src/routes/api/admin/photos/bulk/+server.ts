import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const bulkSchema = z.object({
	action: z.enum(['approve', 'reject']),
	ids: z.array(z.string().uuid()).min(1).max(50)
});

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'editor');

	const raw = await request.json().catch(() => null);
	const parsed = bulkSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request — action and ids[] required (max 50)');

	const { action, ids } = parsed.data;
	const moderation_status = action === 'approve' ? 'approved' : 'rejected';

	const { error: updateError } = await adminSupabase
		.from('pothole_photos')
		.update({ moderation_status })
		.in('id', ids);

	if (updateError) throw error(500, 'Failed to bulk update photos');

	await writeAuditLog(
		locals.adminUser.id,
		`photo.bulk_${action}`,
		'photo',
		null,
		{ ids, count: ids.length },
		getClientAddress()
	);

	return json({ ok: true, updated: ids.length });
};
