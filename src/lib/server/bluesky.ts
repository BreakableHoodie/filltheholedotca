import { env } from '$env/dynamic/private';
import { logError } from '$lib/server/observability';

const BSKY_PDS = 'https://bsky.social';

// Bluesky's grapheme limit per post.
const MAX_POST_LENGTH = 300;

interface Session {
	accessJwt: string;
	did: string;
}

async function createSession(): Promise<Session | null> {
	const handle = env.BLUESKY_HANDLE;
	const password = env.BLUESKY_APP_PASSWORD;

	// Not configured — silently no-op so the app works without Bluesky.
	if (!handle || !password) return null;

	const res = await fetch(`${BSKY_PDS}/xrpc/com.atproto.server.createSession`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier: handle, password }),
		signal: AbortSignal.timeout(8_000)
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		logError('bluesky/session', `Auth failed with HTTP ${res.status}`, new Error(body || String(res.status)));
		return null;
	}

	try {
		return (await res.json()) as Session;
	} catch (e) {
		logError('bluesky/session', 'Failed to parse Bluesky session response', e);
		return null;
	}
}

/**
 * Build a rich-text facet for a URL within the post text.
 * Bluesky requires UTF-8 byte offsets, not character offsets.
 */
function buildUrlFacet(text: string, url: string) {
	const encoder = new TextEncoder();
	const byteStart = encoder.encode(text.slice(0, text.indexOf(url))).length;
	const byteEnd = byteStart + encoder.encode(url).length;
	return {
		index: { byteStart, byteEnd },
		features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }]
	};
}

async function post(text: string, url: string): Promise<void> {
	const session = await createSession();
	if (!session) return;

	const record = {
		$type: 'app.bsky.feed.post',
		text,
		createdAt: new Date().toISOString(),
		facets: text.includes(url) ? [buildUrlFacet(text, url)] : []
	};

	const res = await fetch(`${BSKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${session.accessJwt}`
		},
		body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record }),
		signal: AbortSignal.timeout(8_000)
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		logError('bluesky/post', `Post failed with HTTP ${res.status}`, new Error(body || String(res.status)));
	}
}

function truncateAddress(address: string | null | undefined, maxLen: number): string {
	const a = address?.trim();
	if (!a) return 'Waterloo Region';
	return a.length > maxLen ? a.slice(0, maxLen - 1) + '…' : a;
}

/**
 * Post to Bluesky when a pothole is confirmed and goes live on the map.
 * Fire-and-forget safe — never throws.
 */
export async function postConfirmed(id: string, address: string | null | undefined): Promise<void> {
	try {
		const location = truncateAddress(address, 80);
		const url = `https://fillthehole.ca/hole/${id}`;
		const text = `🚧 New pothole confirmed at ${location}.\n\nIt's now live on the map — see it and help report it to the city:\n${url}`;

		if ([...text].length > MAX_POST_LENGTH) {
			logError('bluesky/post', 'postConfirmed: text too long, skipping', new Error('text exceeded MAX_POST_LENGTH'));
			return;
		}

		await post(text, url);
	} catch (e) {
		logError('bluesky/post', 'postConfirmed failed', e);
	}
}

/**
 * Post to Bluesky when a pothole is marked as filled.
 * Fire-and-forget safe — never throws.
 */
export async function postFilled(id: string, address: string | null | undefined): Promise<void> {
	try {
		const location = truncateAddress(address, 80);
		const url = `https://fillthehole.ca/hole/${id}`;
		const text = `✅ Pothole at ${location} has been filled!\n\nThanks to everyone who reported and confirmed it. 🙌\n${url}`;

		if ([...text].length > MAX_POST_LENGTH) {
			logError('bluesky/post', 'postFilled: text too long, skipping', new Error('text exceeded MAX_POST_LENGTH'));
			return;
		}

		await post(text, url);
	} catch (e) {
		logError('bluesky/post', 'postFilled failed', e);
	}
}
