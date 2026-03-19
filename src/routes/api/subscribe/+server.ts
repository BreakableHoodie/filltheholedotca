import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

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

/** Save a push subscription. Idempotent — upserts by endpoint. */
export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = subscribeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid subscription');

	const db = getServiceClient();
	const { error: dbError } = await db.from('push_subscriptions').upsert(
		{
			endpoint: parsed.data.endpoint,
			p256dh: parsed.data.keys.p256dh,
			auth: parsed.data.keys.auth
		},
		{ onConflict: 'endpoint' }
	);

	if (dbError) throw error(500, 'Failed to save subscription');
	return json({ ok: true });
};

/** Remove a push subscription when the user revokes permission. */
export const DELETE: RequestHandler = async ({ request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = unsubscribeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const db = getServiceClient();
	await db.from('push_subscriptions').delete().eq('endpoint', parsed.data.endpoint);
	return json({ ok: true });
};
