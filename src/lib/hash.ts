/** Hash a client IP address with SHA-256. Raw IPs are never stored or returned. */
export async function hashIp(ip: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
