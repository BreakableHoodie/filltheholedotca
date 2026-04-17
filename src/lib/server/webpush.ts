import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { logError } from '$lib/server/observability';

let initialized = false;

function init() {
	if (initialized) return;
	const publicKey = env.VAPID_PUBLIC_KEY;
	const privateKey = env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) return; // Push disabled if VAPID keys absent
	webpush.setVapidDetails('mailto:admin@fillthehole.ca', publicKey, privateKey);
	initialized = true;
}

export interface PushPayload {
	title: string;
	body: string;
	url?: string;
}

/**
 * Broadcast a push notification to all active subscribers.
 * Fire-and-forget safe: logs errors but does not throw.
 * Automatically removes expired subscriptions (HTTP 410 from push service).
 */
export async function broadcastPush(payload: PushPayload): Promise<void> {
	init();
	if (!initialized) return; // VAPID keys not configured — skip silently

	const db = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { data: subscriptions, error: queryError } = await db
		.from('push_subscriptions')
		.select('endpoint, p256dh, auth');

	if (queryError) {
		logError('webpush', 'failed to load subscriptions', queryError);
		return;
	}
	if (!subscriptions?.length) return;

	const message = JSON.stringify(payload);
	const expired: string[] = [];

	await Promise.allSettled(
		subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					message
				);
			} catch (err: unknown) {
				const status = (err as { statusCode?: number }).statusCode;
				if (status === 410 || status === 404) {
					expired.push(sub.endpoint); // Subscription has expired or been unsubscribed
				} else {
					// Log endpoint origin only — the full URL is a device identifier.
					const origin = (() => { try { return new URL(sub.endpoint).origin; } catch { return 'unknown'; } })();
					logError('webpush', 'send failed', err, { status, endpointOrigin: origin });
				}
			}
		})
	);

	if (expired.length > 0) {
		await db.from('push_subscriptions').delete().in('endpoint', expired);
	}
}
