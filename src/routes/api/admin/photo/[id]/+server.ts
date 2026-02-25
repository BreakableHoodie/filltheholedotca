import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timingSafeEqual } from 'node:crypto';
import { ADMIN_SECRET, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Service role client — bypasses RLS for admin operations.
// Never use this key in client-side code.
const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function isAuthorized(authHeader: string | null): boolean {
	if (!authHeader) return false;
	const expected = Buffer.from(`Bearer ${ADMIN_SECRET}`);
	const provided = Buffer.from(authHeader);
	return expected.length === provided.length && timingSafeEqual(expected, provided);
}

const bodySchema = z.object({ action: z.enum(['approve', 'reject']) });

export const PATCH: RequestHandler = async ({ request, params, getClientAddress }) => {
	if (!isAuthorized(request.headers.get('Authorization'))) {
		console.warn(`[admin] Unauthorized photo PATCH attempt from ${getClientAddress()}`);
		throw error(401, 'Unauthorized');
	}

	const idParsed = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!idParsed.success) throw error(400, 'Invalid ID');

	const bodyParsed = bodySchema.safeParse(await request.json().catch(() => ({})));
	if (!bodyParsed.success) throw error(400, 'Invalid action — expected "approve" or "reject"');

	const { id } = idParsed.data;
	const moderation_status = bodyParsed.data.action === 'approve' ? 'approved' : 'rejected';

	console.info(`[admin] ${moderation_status.toUpperCase()} photo ${id}`);

	const { error: updateError } = await adminSupabase
		.from('pothole_photos')
		.update({ moderation_status })
		.eq('id', id);

	if (updateError) throw error(500, 'Failed to update photo status');

	return json({ ok: true, moderation_status });
};

export const DELETE: RequestHandler = async ({ request, params, getClientAddress }) => {
	if (!isAuthorized(request.headers.get('Authorization'))) {
		console.warn(`[admin] Unauthorized photo DELETE attempt from ${getClientAddress()}`);
		throw error(401, 'Unauthorized');
	}

	const idParsed = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!idParsed.success) throw error(400, 'Invalid ID');

	const { id } = idParsed.data;

	// Look up the storage path before deleting the DB record
	const { data: photo } = await adminSupabase
		.from('pothole_photos')
		.select('storage_path')
		.eq('id', id)
		.single();

	console.info(`[admin] DELETE photo ${id}`);

	const { error: deleteError } = await adminSupabase.from('pothole_photos').delete().eq('id', id);
	if (deleteError) throw error(500, 'Failed to delete photo record');

	// Best-effort storage cleanup (cascade not automatic for storage)
	if (photo?.storage_path) {
		await adminSupabase.storage.from('pothole-photos').remove([photo.storage_path]);
	}

	return json({ ok: true });
};
