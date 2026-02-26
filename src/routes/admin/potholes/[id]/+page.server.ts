import { fail, error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const uuidSchema = z.string().uuid();

export const load: PageServerLoad = async ({ params }) => {
	const idParsed = uuidSchema.safeParse(params.id);
	if (!idParsed.success) throw error(400, 'Invalid pothole ID');
	const id = idParsed.data;

	const [potholeRes, confirmationsRes, photosRes] = await Promise.all([
		adminSupabase.from('potholes').select('*').eq('id', id).single(),
		adminSupabase
			.from('pothole_confirmations')
			.select('id, ip_hash, created_at')
			.eq('pothole_id', id)
			.order('created_at', { ascending: true }),
		adminSupabase
			.from('pothole_photos')
			.select('id, storage_path, moderation_status, moderation_score, created_at')
			.eq('pothole_id', id)
			.order('created_at', { ascending: true })
	]);

	if (!potholeRes.data) throw error(404, 'Pothole not found');

	// Generate signed URLs for all photos
	const photos = photosRes.data ?? [];
	const paths = photos.map((p) => p.storage_path).filter(Boolean);
	let signedUrlMap: Record<string, string> = {};

	if (paths.length > 0) {
		const { data: signedUrls } = await adminSupabase.storage
			.from('pothole-photos')
			.createSignedUrls(paths, 3600);
		for (const item of signedUrls ?? []) {
			if (item.signedUrl && item.path) signedUrlMap[item.path] = item.signedUrl;
		}
	}

	return {
		pothole: potholeRes.data,
		confirmations: confirmationsRes.data ?? [],
		photos: photos.map((p) => ({ ...p, url: signedUrlMap[p.storage_path] ?? null }))
	};
};

// ---------------------------------------------------------------------------
// Form actions (updateStatus, updateAddress, deletePothole)
// Session guaranteed by hooks; CSRF handled by SvelteKit's origin check.
// ---------------------------------------------------------------------------

export const actions: Actions = {
	updateStatus: async ({ params, request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'editor');

		const id = params.id ?? '';
		if (!uuidSchema.safeParse(id).success) return fail(400, { error: 'Invalid ID' });

		const fd = await request.formData();
		const status = fd.get('status')?.toString() ?? '';
		const statusParsed = z.enum(['pending', 'reported', 'filled', 'expired']).safeParse(status);
		if (!statusParsed.success) return fail(400, { error: 'Invalid status' });

		const s = statusParsed.data;
		const updates = {
			status: s,
			filled_at: s === 'filled' ? new Date().toISOString() : null,
			expired_at: s === 'expired' ? new Date().toISOString() : null
		};

		const { error: dbErr } = await adminSupabase.from('potholes').update(updates).eq('id', id);
		if (dbErr) return fail(500, { error: 'Failed to update status' });

		await writeAuditLog(
			locals.adminUser.id,
			'pothole.status_override',
			'pothole',
			id,
			{ status: s },
			getClientAddress()
		);

		return { success: true };
	},

	updateAddress: async ({ params, request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'editor');

		const id = params.id ?? '';
		if (!uuidSchema.safeParse(id).success) return fail(400, { error: 'Invalid ID' });

		const fd = await request.formData();
		const address = fd.get('address')?.toString() ?? '';
		const addressParsed = z.string().min(1).max(500).safeParse(address);
		if (!addressParsed.success) return fail(400, { error: 'Address must be 1–500 characters' });

		const { error: dbErr } = await adminSupabase
			.from('potholes')
			.update({ address: addressParsed.data })
			.eq('id', id);
		if (dbErr) return fail(500, { error: 'Failed to update address' });

		await writeAuditLog(
			locals.adminUser.id,
			'pothole.address_edit',
			'pothole',
			id,
			null,
			getClientAddress()
		);

		return { success: true };
	},

	deletePothole: async ({ params, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'admin');

		const id = params.id ?? '';
		if (!uuidSchema.safeParse(id).success) return fail(400, { error: 'Invalid ID' });

		// Confirmations cascade-delete via FK — explicit delete for safety
		await adminSupabase.from('pothole_confirmations').delete().eq('pothole_id', id);

		const { error: dbErr } = await adminSupabase.from('potholes').delete().eq('id', id);
		if (dbErr) return fail(500, { error: 'Failed to delete pothole' });

		await writeAuditLog(
			locals.adminUser.id,
			'pothole.delete',
			'pothole',
			id,
			null,
			getClientAddress()
		);

		redirect(303, '/admin/potholes');
	}
};
