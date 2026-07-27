import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';
import { hashIp } from '$lib/hash';
import { getAdminClient } from '$lib/server/supabase';
import { logError } from '$lib/server/observability';
type PhotoRow = {
	id: string;
	storage_path: string;
	moderation_status: string;
	moderation_score: number | null;
	created_at: string;
	potholes: {
		id: string;
		address: string | null;
		status: string;
		confirmed_count: number;
	} | null;
};

export const load: PageServerLoad = async ({ locals }) => {
	// Hooks guarantee a valid session; requireRole makes the permission explicit
	// and consistent with the actions below (which require 'editor').
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'viewer');

	// Include 'deferred' photos (SightEngine unavailable — requires mandatory admin review)
	// alongside normal 'pending' photos. Deferred photos are visually flagged in the UI.
	const { data: rawPhotos } = await getAdminClient()
		.from('pothole_photos')
		.select(
			`id, storage_path, moderation_status, moderation_score, created_at,
       potholes!inner ( id, address, status, confirmed_count )`,
		)
		.in('moderation_status', ['pending', 'deferred'])
		.order('moderation_status', { ascending: true }) // 'deferred' < 'pending' — always surfaces first
		.order('created_at', { ascending: true })
		.limit(100);

	const photos = (rawPhotos ?? []) as unknown as PhotoRow[];

	// Batch-generate signed URLs (one round-trip for all photos)
	const paths = photos.map((p) => p.storage_path).filter(Boolean);
	const signedUrlMap: Record<string, string> = {};

	if (paths.length > 0) {
		const { data: signedUrls } = await getAdminClient()
			.storage.from('pothole-photos')
			.createSignedUrls(paths, 3600);

		for (const item of signedUrls ?? []) {
			if (item.signedUrl && item.path) signedUrlMap[item.path] = item.signedUrl;
		}
	}

	return {
		photos: photos.map((p) => ({ ...p, url: signedUrlMap[p.storage_path] ?? null })),
	};
};

// ---------------------------------------------------------------------------
// Form actions (approve, reject, bulkApprove, bulkReject)
// Session is guaranteed by hooks; CSRF handled by SvelteKit's origin check.
// ---------------------------------------------------------------------------

const uuidSchema = z.string().uuid();

export const actions: Actions = {
	approve: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'editor');

		const id = (await request.formData()).get('id')?.toString() ?? '';
		if (!uuidSchema.safeParse(id).success) return fail(400, { error: 'Invalid ID' });

		const { error: dbErr } = await getAdminClient()
			.from('pothole_photos')
			.update({ moderation_status: 'approved' })
			.eq('id', id);
		if (dbErr) {
			logError('admin/photos', 'Failed to approve photo', dbErr, { photoId: id });
			return fail(500, { error: 'Failed to approve photo' });
		}

		await writeAuditLog(
			locals.adminUser.id,
			'photo.approve',
			'photo',
			id,
			null,
			await hashIp(getClientAddress()),
		);
		return { success: true };
	},

	reject: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'editor');

		const id = (await request.formData()).get('id')?.toString() ?? '';
		if (!uuidSchema.safeParse(id).success) return fail(400, { error: 'Invalid ID' });

		// Capture the storage path before the flip — the bucket is public, so a
		// rejected image keeps serving from its object URL unless we pull it too.
		const { data: photo, error: lookupError } = await getAdminClient()
			.from('pothole_photos')
			.select('storage_path')
			.eq('id', id)
			.single();

		// Deliberately not fatal: the moderation flag is what gates display, so
		// aborting here would leave the photo in its previous (possibly approved)
		// state. Log so a skipped cleanup is visible rather than silent.
		if (lookupError) {
			logError('admin/photos', 'Failed to load storage path before reject', lookupError, {
				photoId: id,
			});
		}

		const { error: dbErr } = await getAdminClient()
			.from('pothole_photos')
			.update({ moderation_status: 'rejected' })
			.eq('id', id);
		if (dbErr) {
			logError('admin/photos', 'Failed to reject photo', dbErr, { photoId: id });
			return fail(500, { error: 'Failed to reject photo' });
		}

		// Best-effort: a storage failure must not fail the reject, since the
		// moderation flag is what actually gates display.
		if (photo?.storage_path) {
			const { error: storageErr } = await getAdminClient()
				.storage.from('pothole-photos')
				.remove([photo.storage_path]);
			if (storageErr)
				logError('admin/photos', 'Storage cleanup failed after photo reject', storageErr, {
					storagePath: photo.storage_path,
					photoId: id,
				});
		}

		await writeAuditLog(
			locals.adminUser.id,
			'photo.reject',
			'photo',
			id,
			null,
			await hashIp(getClientAddress()),
		);
		return { success: true };
	},

	bulkApprove: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'editor');

		const ids = (await request.formData())
			.getAll('ids')
			.map(String)
			.filter((id) => uuidSchema.safeParse(id).success);
		if (ids.length === 0) return fail(400, { error: 'No valid photos selected' });
		if (ids.length > 50) return fail(400, { error: 'Maximum 50 photos per bulk action' });

		const { error: dbErr } = await getAdminClient()
			.from('pothole_photos')
			.update({ moderation_status: 'approved' })
			.in('id', ids);
		if (dbErr) {
			logError('admin/photos', 'Failed to bulk approve photos', dbErr, { count: ids.length });
			return fail(500, { error: 'Failed to approve photos' });
		}

		await writeAuditLog(
			locals.adminUser.id,
			'photo.bulk_approve',
			'photo',
			null,
			{ count: ids.length },
			await hashIp(getClientAddress()),
		);
		return { success: true };
	},

	bulkReject: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'editor');

		const ids = (await request.formData())
			.getAll('ids')
			.map(String)
			.filter((id) => uuidSchema.safeParse(id).success);
		if (ids.length === 0) return fail(400, { error: 'No valid photos selected' });
		if (ids.length > 50) return fail(400, { error: 'Maximum 50 photos per bulk action' });

		// Same rationale as the single reject: the bucket is public, so the objects
		// must go too. Collect paths before the flip, remove them in one call after.
		const { data: photos, error: lookupError } = await getAdminClient()
			.from('pothole_photos')
			.select('storage_path')
			.in('id', ids);

		// Same rationale as the single reject above — log, do not abort.
		if (lookupError) {
			logError(
				'admin/photos',
				'Failed to load storage paths before bulk reject',
				lookupError,
				{
					count: ids.length,
				},
			);
		}

		const { error: dbErr } = await getAdminClient()
			.from('pothole_photos')
			.update({ moderation_status: 'rejected' })
			.in('id', ids);
		if (dbErr) {
			logError('admin/photos', 'Failed to bulk reject photos', dbErr, { count: ids.length });
			return fail(500, { error: 'Failed to reject photos' });
		}

		const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
		if (paths.length > 0) {
			const { error: storageErr } = await getAdminClient()
				.storage.from('pothole-photos')
				.remove(paths);
			if (storageErr)
				logError('admin/photos', 'Storage cleanup failed after bulk reject', storageErr, {
					count: paths.length,
				});
		}

		await writeAuditLog(
			locals.adminUser.id,
			'photo.bulk_reject',
			'photo',
			null,
			{ count: ids.length },
			await hashIp(getClientAddress()),
		);
		return { success: true };
	},
};
