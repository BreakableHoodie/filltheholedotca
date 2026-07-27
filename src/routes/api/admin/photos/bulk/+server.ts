import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';
import { hashIp } from '$lib/hash';
import { getAdminClient } from '$lib/server/supabase';
import { logError } from '$lib/server/observability';
const bulkSchema = z.object({
	action: z.enum(['approve', 'reject']),
	ids: z.array(z.string().uuid()).min(1).max(50),
});

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'editor');

	const raw = await request.json().catch(() => null);
	const parsed = bulkSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request — action and ids[] required (max 50)');

	const { action, ids } = parsed.data;
	const moderation_status = action === 'approve' ? 'approved' : 'rejected';

	// Capture storage paths before the flip. The pothole-photos bucket is public,
	// so a rejected image keeps serving from its object URL unless removed too.
	// This is the fourth reject path in the codebase — the other three live in
	// admin/photos/+page.server.ts (reject, bulkReject) and api/admin/photo/[id].
	const { data: photos, error: lookupError } =
		moderation_status === 'rejected'
			? await getAdminClient().from('pothole_photos').select('storage_path').in('id', ids)
			: { data: null, error: null };

	// A failed lookup means cleanup cannot run. Deliberately do NOT abort: the
	// moderation flag is what gates display, so bailing here would leave the
	// photos in their previous (possibly approved, publicly rendered) state —
	// strictly worse than an orphaned object. Log so the leak is visible.
	if (lookupError) {
		logError(
			'admin/photos-bulk',
			'Failed to load storage paths before bulk reject',
			lookupError,
			{
				count: ids.length,
			},
		);
	}

	const { error: updateError } = await getAdminClient()
		.from('pothole_photos')
		.update({ moderation_status })
		.in('id', ids);

	if (updateError) {
		logError('admin/photos-bulk', 'Failed to bulk update photos', updateError, {
			action,
			count: ids.length,
		});
		throw error(500, 'Failed to bulk update photos');
	}

	// Best-effort: the moderation flag is what gates display, so a storage failure
	// must not fail the whole reject. It is logged so a leftover object is
	// recoverable rather than silent.
	const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
	if (paths.length > 0) {
		const { error: storageErr } = await getAdminClient()
			.storage.from('pothole-photos')
			.remove(paths);
		if (storageErr)
			logError('admin/photos-bulk', 'Storage cleanup failed after bulk reject', storageErr, {
				count: paths.length,
			});
	}

	await writeAuditLog(
		locals.adminUser.id,
		`photo.bulk_${action}`,
		'photo',
		null,
		{ ids, count: ids.length },
		await hashIp(getClientAddress()),
	);

	return json({ ok: true, updated: ids.length });
};
