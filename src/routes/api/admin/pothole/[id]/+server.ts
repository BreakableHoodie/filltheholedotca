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

export const DELETE: RequestHandler = async ({ request, params }) => {
	if (!isAuthorized(request.headers.get('Authorization'))) {
		throw error(401, 'Unauthorized');
	}

	const parsed = z.object({ id: z.string().uuid() }).safeParse(params);

	if (!parsed.success) {
		throw error(400, 'Invalid ID');
	}

	const { id } = parsed.data;

	// Confirmations cascade-delete via FK, but be explicit
	await adminSupabase.from('pothole_confirmations').delete().eq('pothole_id', id);

	const { error: deleteError } = await adminSupabase.from('potholes').delete().eq('id', id);
	if (deleteError) throw error(500, 'Failed to delete');

	return json({ ok: true });
};
