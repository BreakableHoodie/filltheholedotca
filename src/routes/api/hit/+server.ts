import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { hashIp } from '$lib/hash';

function getServiceClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const schema = z.object({ id: z.string().uuid() });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = schema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const ipHash = await hashIp(getClientAddress());
	const db = getServiceClient();

	const { error: insertError } = await db
		.from('pothole_hits')
		.insert({ pothole_id: parsed.data.id, ip_hash: ipHash });

	if (insertError) {
		if (insertError.code === '23505') {
			// Already recorded — return current count without error
			const { count } = await db
				.from('pothole_hits')
				.select('*', { count: 'exact', head: true })
				.eq('pothole_id', parsed.data.id);
			return json({ ok: false, message: "Already recorded.", count: count ?? 0 });
		}
		throw error(500, 'Failed to record hit');
	}

	const { count } = await db
		.from('pothole_hits')
		.select('*', { count: 'exact', head: true })
		.eq('pothole_id', parsed.data.id);

	return json({ ok: true, count: count ?? 0 });
};
