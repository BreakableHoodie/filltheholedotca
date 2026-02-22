import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_SECRET } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

export const DELETE: RequestHandler = async ({ request, params }) => {
	const auth = request.headers.get('Authorization');
	if (!auth || auth !== `Bearer ${ADMIN_SECRET}`) {
		throw error(401, 'Unauthorized');
	}

	const paramsSchema = z.object({
		id: z.string().uuid()
	});

	const parsed = paramsSchema.safeParse(params);

	if (!parsed.success) {
		throw error(400, 'Invalid ID');
	}

	const { id } = parsed.data;

	// Confirmations cascade-delete via FK, but be explicit
	await supabase.from('pothole_confirmations').delete().eq('pothole_id', id);

	const { error: deleteError } = await supabase.from('potholes').delete().eq('id', id);
	if (deleteError) throw error(500, 'Failed to delete');

	return json({ ok: true, deleted: id });
};
