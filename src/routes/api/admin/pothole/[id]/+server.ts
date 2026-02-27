import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';
import { hashIp } from '$lib/hash';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const patchSchema = z
	.object({
		status: z.enum(['pending', 'reported', 'filled', 'expired']).optional(),
		address: z.string().min(1).max(500).optional()
	})
	.refine((d) => d.status !== undefined || d.address !== undefined, {
		message: 'At least one field required'
	});

// PATCH — status override or address correction (editor+)
export const PATCH: RequestHandler = async ({ params, request, locals, getClientAddress }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'editor');

	const parsed = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!parsed.success) throw error(400, 'Invalid ID');
	const { id } = parsed.data;

	const body = await request.json();
	const bodyParsed = patchSchema.safeParse(body);
	if (!bodyParsed.success) throw error(400, bodyParsed.error.issues[0]?.message ?? 'Invalid request body');

	const updates: Record<string, unknown> = {};
	if (bodyParsed.data.address !== undefined) updates.address = bodyParsed.data.address;
	if (bodyParsed.data.status !== undefined) {
		const s = bodyParsed.data.status;
		updates.status = s;
		updates.filled_at = s === 'filled' ? new Date().toISOString() : null;
		updates.expired_at = s === 'expired' ? new Date().toISOString() : null;
	}

	const { error: dbErr } = await adminSupabase.from('potholes').update(updates).eq('id', id);
	if (dbErr) throw error(500, 'Failed to update');

	await writeAuditLog(
		locals.adminUser.id,
		'pothole.update',
		'pothole',
		id,
		{ fields: Object.keys(updates) },
		await hashIp(getClientAddress())
	);

	return json({ ok: true });
};

// DELETE — hard delete (admin only)
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

	await writeAuditLog(locals.adminUser.id, 'pothole.delete', 'pothole', id, null, await hashIp(getClientAddress()));

	return json({ ok: true });
};
