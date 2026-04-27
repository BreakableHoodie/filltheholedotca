import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { hashIp } from '$lib/hash';
import { logError } from '$lib/server/observability';
import { getAdminClient } from '$lib/server/supabase';

const subscribeSchema = z.object({
	endpoint: z.string().url().max(2048),
	keys: z.object({
		p256dh: z.string().min(1).max(512),
		auth: z.string().min(1).max(256)
	})
});

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Subscribe to a one-shot fill notification for this pothole. */
export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	const parsedId = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!parsedId.success) throw error(400, 'Invalid ID');
	const { id } = parsedId.data;

	const raw = await request.json().catch(() => null);
	const parsed = subscribeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid subscription');

	const ipHash = await hashIp(getClientAddress());
	const db = getAdminClient();

	const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
	const { count: recent, error: rateLimitError } = await db
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'fill_notify_subscribe')
		.gte('created_at', windowStart);

	if (rateLimitError) throw error(500, 'Failed to check rate limit');
	if ((recent ?? 0) >= RATE_LIMIT) throw error(429, 'Too many requests. Please wait before trying again.');

	// Confirm the pothole exists and is in a state where a fill notification makes sense.
	const { data: pothole, error: potholeErr } = await db
		.from('potholes')
		.select('status')
		.eq('id', id)
		.single();
	if (potholeErr || !pothole) throw error(404, 'Pothole not found');
	if (pothole.status === 'filled') throw error(409, 'Pothole is already filled');
	if (pothole.status === 'expired') throw error(409, 'Pothole has expired');

	const { error: dbError } = await db.from('pothole_fill_subscriptions').upsert(
		{
			pothole_id: id,
			endpoint: parsed.data.endpoint,
			p256dh: parsed.data.keys.p256dh,
			auth: parsed.data.keys.auth
		},
		{ onConflict: 'pothole_id,endpoint' }
	);
	if (dbError) throw error(500, 'Failed to save subscription');

	const { error: rlErr } = await db
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'fill_notify_subscribe' });
	if (rlErr) logError('notify/ratelimit', 'Failed to record rate limit event', rlErr);

	return json({ ok: true });
};

/** Remove a per-pothole fill notification subscription. */
export const DELETE: RequestHandler = async ({ params, request }) => {
	const parsedId = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!parsedId.success) throw error(400, 'Invalid ID');

	const raw = await request.json().catch(() => null);
	const parsed = z.object({ endpoint: z.string().url().max(2048) }).safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const { error: deleteError } = await getAdminClient()
		.from('pothole_fill_subscriptions')
		.delete()
		.eq('pothole_id', parsedId.data.id)
		.eq('endpoint', parsed.data.endpoint);
	if (deleteError) throw error(500, 'Failed to remove subscription');

	return json({ ok: true });
};
