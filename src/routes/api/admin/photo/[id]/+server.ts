import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const bodySchema = z.object({ action: z.enum(['approve', 'reject']) });

export const PATCH: RequestHandler = async ({ request, params, locals, getClientAddress }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'editor');

	const idParsed = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!idParsed.success) throw error(400, 'Invalid ID');

	const bodyParsed = bodySchema.safeParse(await request.json().catch(() => ({})));
	if (!bodyParsed.success) throw error(400, 'Invalid action — expected "approve" or "reject"');

	const { id } = idParsed.data;
	const moderation_status = bodyParsed.data.action === 'approve' ? 'approved' : 'rejected';

	const { error: updateError } = await adminSupabase
		.from('pothole_photos')
		.update({ moderation_status })
		.eq('id', id);

	if (updateError) throw error(500, 'Failed to update photo status');

	await writeAuditLog(
		locals.adminUser.id,
		`photo.${bodyParsed.data.action}`,
		'photo',
		id,
		{ moderation_status },
		getClientAddress()
	);

	return json({ ok: true, moderation_status });
};

export const DELETE: RequestHandler = async ({ params, locals, getClientAddress }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'editor');

	const idParsed = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!idParsed.success) throw error(400, 'Invalid ID');

	const { id } = idParsed.data;

	// Look up storage path before deleting the record
	const { data: photo } = await adminSupabase
		.from('pothole_photos')
		.select('storage_path')
		.eq('id', id)
		.single();

	const { error: deleteError } = await adminSupabase.from('pothole_photos').delete().eq('id', id);
	if (deleteError) throw error(500, 'Failed to delete photo record');

	// Best-effort storage cleanup
	if (photo?.storage_path) {
		await adminSupabase.storage.from('pothole-photos').remove([photo.storage_path]);
	}

	await writeAuditLog(
		locals.adminUser.id,
		'photo.delete',
		'photo',
		id,
		{ storage_path: photo?.storage_path ?? null },
		getClientAddress()
	);

	return json({ ok: true });
};
