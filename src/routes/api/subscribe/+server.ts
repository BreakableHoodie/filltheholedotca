import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { hashIp } from '$lib/hash';
import { logError } from '$lib/server/observability';

function getServiceClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const subscribeSchema = z.object({
	endpoint: z.string().url().max(2048),
	keys: z.object({
		p256dh: z.string().min(1).max(512),
		auth: z.string().min(1).max(256)
	})
});

const unsubscribeSchema = z.object({
	endpoint: z.string().url().max(2048)
});

const SUBSCRIBE_RATE_LIMIT = 5;
const UNSUBSCRIBE_RATE_LIMIT = 10;
const SUBSCRIBE_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Save a push subscription. Idempotent — upserts by endpoint. */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = subscribeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid subscription');

	const ipHash = await hashIp(getClientAddress());
	const db = getServiceClient();

	const windowStart = new Date(Date.now() - SUBSCRIBE_RATE_WINDOW_MS).toISOString();
	const { count: recentSubs, error: rateLimitError } = await db
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'push_subscribe')
		.gte('created_at', windowStart);

	if (rateLimitError) throw error(500, 'Failed to check rate limit');
	if ((recentSubs ?? 0) >= SUBSCRIBE_RATE_LIMIT) {
		throw error(429, 'Too many subscription attempts. Please wait before trying again.');
	}

	const { error: dbError } = await db.from('push_subscriptions').upsert(
		{
			endpoint: parsed.data.endpoint,
			p256dh: parsed.data.keys.p256dh,
			auth: parsed.data.keys.auth
		},
		{ onConflict: 'endpoint' }
	);

	if (dbError) throw error(500, 'Failed to save subscription');

	const { error: rateLimitInsertError } = await db
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'push_subscribe' });
	if (rateLimitInsertError) {
		logError('subscribe/ratelimit', 'Failed to record rate limit event', rateLimitInsertError);
	}

	return json({ ok: true });
};

/** Remove a push subscription when the user revokes permission. */
export const DELETE: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = unsubscribeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const ipHash = await hashIp(getClientAddress());
	const db = getServiceClient();

	const windowStart = new Date(Date.now() - SUBSCRIBE_RATE_WINDOW_MS).toISOString();
	const { count: recentUnsubs, error: rateLimitError } = await db
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'push_unsubscribe')
		.gte('created_at', windowStart);

	if (rateLimitError) throw error(500, 'Failed to check rate limit');
	if ((recentUnsubs ?? 0) >= UNSUBSCRIBE_RATE_LIMIT) {
		throw error(429, 'Too many unsubscribe attempts. Please wait before trying again.');
	}

	const { error: deleteError } = await db
		.from('push_subscriptions')
		.delete()
		.eq('endpoint', parsed.data.endpoint);
	if (deleteError) throw error(500, 'Failed to remove subscription');

	const { error: rateLimitInsertError } = await db
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'push_unsubscribe' });
	if (rateLimitInsertError) {
		logError('subscribe/ratelimit', 'Failed to record unsubscribe rate limit event', rateLimitInsertError);
	}

	return json({ ok: true });
};
