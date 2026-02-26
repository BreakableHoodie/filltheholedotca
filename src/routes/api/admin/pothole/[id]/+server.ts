import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const DELETE: RequestHandler = async ({ params, locals, getClientAddress }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'admin');

	const parsed = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!parsed.success) throw error(400, 'Invalid ID');

	const { id } = parsed.data;

	// Confirmations cascade-delete via FK — delete explicitly for safety
	await adminSupabase.from('pothole_confirmations').delete().eq('pothole_id', id);

	const { error: deleteError } = await adminSupabase.from('potholes').delete().eq('id', id);
	if (deleteError) throw error(500, 'Failed to delete');

	await writeAuditLog(locals.adminUser.id, 'pothole.delete', 'pothole', id, null, getClientAddress());

	return json({ ok: true });
};
