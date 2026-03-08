import { env } from '$env/dynamic/private';

export interface PushoverMessage {
	message: string;
	title?: string;
	url?: string;
	urlTitle?: string;
	/** -1 quiet, 0 normal, 1 high (bypasses quiet hours). Default: 0. */
	priority?: -1 | 0 | 1;
}

/**
 * Send a Pushover notification.
 *
 * Non-fatal: silently skips if PUSHOVER_APP_TOKEN / PUSHOVER_USER_KEY are not
 * set, and logs but never throws on API or network failures. Call sites do not
 * need try/catch.
 */
export async function sendPushover(opts: PushoverMessage): Promise<void> {
	const token = env.PUSHOVER_APP_TOKEN;
	const user = env.PUSHOVER_USER_KEY;

	// Not configured — silently no-op so the app works without Pushover.
	if (!token || !user) return;

	try {
		const body: Record<string, string | number> = { token, user, message: opts.message };
		if (opts.title) body.title = opts.title;
		if (opts.url) body.url = opts.url;
		if (opts.urlTitle) body.url_title = opts.urlTitle;
		if (opts.priority !== undefined) body.priority = opts.priority;

		const res = await fetch('https://api.pushover.net/1/messages.json', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
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
