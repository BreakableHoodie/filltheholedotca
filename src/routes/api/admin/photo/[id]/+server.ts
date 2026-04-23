import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';
import { hashIp } from '$lib/hash';
import { logError } from '$lib/server/observability';
import { getAdminClient } from '$lib/server/supabase';
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

	if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
		return json({ ok: true, moderation_status });
	}

	const { error: updateError } = await getAdminClient()
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
		await hashIp(getClientAddress())
	);

	return json({ ok: true, moderation_status });
};

export const DELETE: RequestHandler = async ({ params, locals, getClientAddress }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'editor');

	const idParsed = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!idParsed.success) throw error(400, 'Invalid ID');

	const { id } = idParsed.data;

	if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
		return json({ ok: true });
	}

	// Look up storage path before deleting the record
	const { data: photo } = await getAdminClient()
		.from('pothole_photos')
		.select('storage_path')
		.eq('id', id)
		.single();

	const { error: deleteError } = await getAdminClient().from('pothole_photos').delete().eq('id', id);
	if (deleteError) throw error(500, 'Failed to delete photo record');

	// Best-effort storage cleanup
	if (photo?.storage_path) {
		const { error: storageError } = await getAdminClient()
			.storage
			.from('pothole-photos')
			.remove([photo.storage_path]);
		if (storageError) logError('photos/admin-delete', 'Storage cleanup failed after photo delete', storageError, { storagePath: photo.storage_path, photoId: id });
	}

	await writeAuditLog(
		locals.adminUser.id,
		'photo.delete',
		'photo',
		id,
		{ storage_path: photo?.storage_path ?? null },
		await hashIp(getClientAddress())
	);

	return json({ ok: true });
};
