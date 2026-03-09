import { env } from '$env/dynamic/private';

/**
 * Hash a client IP address with HMAC-SHA-256 using a server-side secret.
 *
 * Plain SHA-256 is insufficient for IP addresses: the entire IPv4 space
 * (~4B values) can be precomputed in minutes, making a DB dump trivially
 * reversible. HMAC-SHA-256 binds the hash to a secret key so database
 * exposure alone reveals nothing. Raw IPs are never stored or returned.
 */

// Cache the imported key across warm invocations — avoids redundant crypto.subtle.importKey calls.
let _key: CryptoKey | null = null;

async function getHmacKey(): Promise<CryptoKey> {
	if (_key) return _key;
	const secret = env.IP_HASH_SECRET;
	if (!secret) {
		throw new Error('IP_HASH_SECRET is not configured');
	}
	_key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return _key;
}

export async function hashIp(ip: string): Promise<string> {
	const key = await getHmacKey();
	const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function hashClientAddressForLog(
	getClientAddress: () => string,
	scope: string = 'security'
): Promise<string> {
	try {
		return await hashIp(getClientAddress());
	} catch (e) {
		console.error(`[${scope}] Failed to hash client IP for logging:`, e);
		return 'unavailable';
	}
}
