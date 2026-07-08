import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { hashIp } from '$lib/hash';
import { logError } from '$lib/server/observability';
import { getAdminClient } from '$lib/server/supabase';
import { isSafePushEndpoint } from '$lib/server/ssrf';
import { isKnownWardKey } from '$lib/wards';

const subscribeSchema = z.object({
	ward_key: z.string().max(64).refine(isKnownWardKey, 'Unknown ward'),
	endpoint: z.string().url().max(2048),
	keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(256) })
});

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Subscribe to "new pothole" push notifications for a ward. */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = subscribeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid subscription');
	if (!isSafePushEndpoint(parsed.data.endpoint)) throw error(400, 'Invalid subscription');

	const ipHash = await hashIp(getClientAddress());
	const db = getAdminClient();

	const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
	const { count: recent, error: rlErr } = await db
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'ward_notify_subscribe')
		.gte('created_at', windowStart);
	if (rlErr) throw error(500, 'Failed to check rate limit');
	if ((recent ?? 0) >= RATE_LIMIT) throw error(429, 'Too many requests. Please wait before trying again.');

	const { error: dbError } = await db.from('ward_subscriptions').upsert(
		{
			ward_key: parsed.data.ward_key,
			endpoint: parsed.data.endpoint,
			p256dh: parsed.data.keys.p256dh,
			auth: parsed.data.keys.auth
		},
		{ onConflict: 'ward_key,endpoint' }
	);
	if (dbError) throw error(500, 'Failed to save subscription');

	const { error: insErr } = await db
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'ward_notify_subscribe' });
	if (insErr) logError('notify/ward/ratelimit', 'Failed to record rate limit event', insErr);

	return json({ ok: true });
};

/** Remove a ward push notification subscription. */
export const DELETE: RequestHandler = async ({ request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = z
		.object({ ward_key: z.string().max(64), endpoint: z.string().url().max(2048) })
		.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const { error: delErr } = await getAdminClient()
		.from('ward_subscriptions')
		.delete()
		.eq('ward_key', parsed.data.ward_key)
		.eq('endpoint', parsed.data.endpoint);
	if (delErr) throw error(500, 'Failed to remove subscription');

	return json({ ok: true });
};
