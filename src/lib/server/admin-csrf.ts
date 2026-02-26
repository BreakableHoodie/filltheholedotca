import { ADMIN_SESSION_SECRET } from '$env/static/private';

// ---------------------------------------------------------------------------
// CSRF protection — double-submit cookie pattern
//
// On session creation:
//   1. Generate token = HMAC-SHA-256(sessionId, ADMIN_SESSION_SECRET)
//   2. Set csrf_token cookie (non-HttpOnly so JS can read it)
//
// On state-changing requests (POST/PATCH/DELETE):
//   1. Read X-CSRF-Token header from request
//   2. Read csrf_token cookie from request
//   3. Verify they match AND that HMAC(sessionId) == token
//
// The binding to sessionId means stolen cookies don't grant CSRF bypass.
// ---------------------------------------------------------------------------

export const CSRF_COOKIE = 'admin_csrf';
export const CSRF_HEADER = 'x-csrf-token';

let keyCache: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
	if (keyCache) return keyCache;
	const raw = new TextEncoder().encode(ADMIN_SESSION_SECRET);
	keyCache = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify'
	]);
	return keyCache;
}

export async function generateCsrfToken(sessionId: string): Promise<string> {
	const key = await getKey();
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sessionId));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function validateCsrfToken(sessionId: string, token: string): Promise<boolean> {
	if (!token) return false;
	const expected = await generateCsrfToken(sessionId);
	if (expected.length !== token.length) return false;
	// Constant-time string comparison
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
	return diff === 0;
}

/** Build the CSRF cookie string (non-HttpOnly so client JS can attach it to requests). */
export function buildCsrfCookie(token: string, isSecure: boolean): string {
	const parts = [`${CSRF_COOKIE}=${token}`, 'SameSite=Strict', 'Path=/admin'];
	if (isSecure) parts.push('Secure');
	const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
	parts.push(`Expires=${expires}`);
	return parts.join('; ');
}

export function clearCsrfCookie(): string {
	return `${CSRF_COOKIE}=; SameSite=Strict; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
