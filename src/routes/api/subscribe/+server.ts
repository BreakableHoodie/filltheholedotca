import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { hashIp } from '$lib/hash';
import { logError } from '$lib/server/observability';
import { checkAndRecordRateLimit } from '$lib/server/rate-limit';
import { getAdminClient } from '$lib/server/supabase';
import { isSafePushEndpoint } from '$lib/server/ssrf';

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
	if (!isSafePushEndpoint(parsed.data.endpoint)) throw error(400, 'Invalid subscription');

	const ipHash = await hashIp(getClientAddress());
	const db = getAdminClient();

	await checkAndRecordRateLimit(
		db,
		ipHash,
		'push_subscribe',
		SUBSCRIBE_RATE_LIMIT,
		SUBSCRIBE_RATE_WINDOW_MS,
		'Too many subscription attempts. Please wait before trying again.',
		'api/subscribe',
		'Failed to check rate limit'
	);

	const { error: dbError } = await db.from('push_subscriptions').upsert(
		{
			endpoint: parsed.data.endpoint,
			p256dh: parsed.data.keys.p256dh,
			auth: parsed.data.keys.auth,
			last_used_at: new Date().toISOString()
		},
		{ onConflict: 'endpoint' }
	);

	if (dbError) {
		logError('api/subscribe', 'Failed to save push subscription', dbError);
		throw error(500, 'Failed to save subscription');
	}

	return json({ ok: true });
};

/** Remove a push subscription when the user revokes permission. */
export const DELETE: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = unsubscribeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const ipHash = await hashIp(getClientAddress());
	const db = getAdminClient();

	await checkAndRecordRateLimit(
		db,
		ipHash,
		'push_unsubscribe',
		UNSUBSCRIBE_RATE_LIMIT,
		SUBSCRIBE_RATE_WINDOW_MS,
		'Too many unsubscribe attempts. Please wait before trying again.',
		'api/subscribe',
		'Failed to check rate limit'
	);

	const { error: deleteError } = await db
		.from('push_subscriptions')
		.delete()
		.eq('endpoint', parsed.data.endpoint);
	if (deleteError) {
		logError('api/subscribe', 'Failed to remove push subscription', deleteError);
		throw error(500, 'Failed to remove subscription');
	}

	return json({ ok: true });
};
