import { env } from '$env/dynamic/private';
import { getSetting } from '$lib/server/settings';

export interface PushoverMessage {
	message: string;
	title?: string;
	url?: string;
	urlTitle?: string;
	/** -1 quiet, 0 normal, 1 high (bypasses quiet hours). Default: 0. */
	priority?: -1 | 0 | 1;
}

/**
 * Notification categories — map to site_settings keys:
 *   pushover_notify_photos     → new photos awaiting moderation
 *   pushover_notify_community  → pothole confirmed / filled
 *   pushover_notify_security   → admin logins + rate-limit alerts
 */
export type NotifyCategory = 'photos' | 'community' | 'security';

async function isPushoverEnabled(): Promise<boolean> {
	const master = await getSetting('pushover_enabled', 'true');
	return master === 'true';
}

async function isCategoryEnabled(category: NotifyCategory): Promise<boolean> {
	const key = `pushover_notify_${category}`;
	const val = await getSetting(key, 'true');
	return val === 'true';
}

/**
 * Send a Pushover notification, respecting the master toggle and category
 * toggles configured in Site Settings.
 *
 * Fire-and-forget safe: never throws. Call with `void notify(...)` on
 * response-critical paths to avoid blocking on external API latency.
 */
export async function notify(category: NotifyCategory, opts: PushoverMessage): Promise<void> {
	try {
		if (!(await isPushoverEnabled())) return;
		if (!(await isCategoryEnabled(category))) return;
		await sendPushover(opts);
	} catch (e) {
		console.error('[pushover] notify() failed:', e);
	}
}

/**
 * Low-level send — bypasses all settings checks. Prefer `notify()` at
 * call sites. Non-fatal: logs errors, never throws.
 */
async function sendPushover(opts: PushoverMessage): Promise<void> {
	const token = env.PUSHOVER_APP_TOKEN;
	const user = env.PUSHOVER_USER_KEY;

	// Not configured — silently no-op so the app works without Pushover.
	if (!token || !user) return;

	try {
		// Pushover requires application/x-www-form-urlencoded, not JSON.
		const body = new URLSearchParams();
		body.append('token', token);
		body.append('user', user);
		body.append('message', opts.message);
		if (opts.title) body.append('title', opts.title);
		if (opts.url) body.append('url', opts.url);
		if (opts.urlTitle) body.append('url_title', opts.urlTitle);
		if (opts.priority !== undefined) body.append('priority', String(opts.priority));

		const res = await fetch('https://api.pushover.net/1/messages.json', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
			body,
			signal: AbortSignal.timeout(5_000)
		});

		if (!res.ok) {
			const data = await res.json().catch(() => null);
			console.error('[pushover] API error:', res.status, data);
		}
	} catch (e) {
		console.error('[pushover] Failed to send notification:', e);
	}
}
