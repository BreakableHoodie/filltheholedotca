import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';
import { hashIp } from '$lib/hash';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type PhotoRow = {
	id: string;
	storage_path: string;
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

	const { data: rawPhotos } = await adminSupabase
		.from('pothole_photos')
		.select(
			`id, storage_path, moderation_score, created_at,
       potholes!inner ( id, address, status, confirmed_count )`
		)
		.eq('moderation_status', 'pending')
		.order('created_at', { ascending: true })
		.limit(100);

	const photos = (rawPhotos ?? []) as unknown as PhotoRow[];

	// Batch-generate signed URLs (one round-trip for all photos)
	const paths = photos.map((p) => p.storage_path).filter(Boolean);
	const signedUrlMap: Record<string, string> = {};

	if (paths.length > 0) {
		const { data: signedUrls } = await adminSupabase.storage
			.from('pothole-photos')
			.createSignedUrls(paths, 3600);

		for (const item of signedUrls ?? []) {
			if (item.signedUrl && item.path) signedUrlMap[item.path] = item.signedUrl;
		}
	}

	return {
		photos: photos.map((p) => ({ ...p, url: signedUrlMap[p.storage_path] ?? null }))
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

		const { error: dbErr } = await adminSupabase
			.from('pothole_photos')
			.update({ moderation_status: 'approved' })
			.eq('id', id);
		if (dbErr) return fail(500, { error: 'Failed to approve photo' });

		await writeAuditLog(locals.adminUser.id, 'photo.approve', 'photo', id, null, await hashIp(getClientAddress()));
		return { success: true };
	},

	reject: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'editor');

		const id = (await request.formData()).get('id')?.toString() ?? '';
		if (!uuidSchema.safeParse(id).success) return fail(400, { error: 'Invalid ID' });

		const { error: dbErr } = await adminSupabase
			.from('pothole_photos')
			.update({ moderation_status: 'rejected' })
			.eq('id', id);
		if (dbErr) return fail(500, { error: 'Failed to reject photo' });

		await writeAuditLog(locals.adminUser.id, 'photo.reject', 'photo', id, null, await hashIp(getClientAddress()));
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

		const { error: dbErr } = await adminSupabase
			.from('pothole_photos')
			.update({ moderation_status: 'approved' })
			.in('id', ids);
		if (dbErr) return fail(500, { error: 'Failed to approve photos' });

		await writeAuditLog(
			locals.adminUser.id,
			'photo.bulk_approve',
			'photo',
			null,
			{ count: ids.length },
			await hashIp(getClientAddress())
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

		const { error: dbErr } = await adminSupabase
			.from('pothole_photos')
			.update({ moderation_status: 'rejected' })
			.in('id', ids);
		if (dbErr) return fail(500, { error: 'Failed to reject photos' });

		await writeAuditLog(
			locals.adminUser.id,
			'photo.bulk_reject',
			'photo',
			null,
			{ count: ids.length },
			await hashIp(getClientAddress())
		);
		return { success: true };
	}
};
