/**
 * Returns true only for HTTPS endpoints that are not loopback, link-local,
 * or private/internal-network addresses. Intended to guard push endpoint URLs
 * before storing or dispatching to prevent Server-Side Request Forgery (SSRF).
 *
 * Limitation: DNS rebinding (a public hostname that resolves to a private IP)
 * cannot be caught without performing a DNS lookup at validation time. The
 * check covers the large majority of direct-IP attack vectors; accepting only
 * known push-service domains would be stronger but would break self-hosted relays.
 */
export function isSafePushEndpoint(endpoint: string): boolean {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return false;
	}
	if (url.protocol !== 'https:') return false;
	const h = url.hostname.toLowerCase();

	// IPv4 loopback
	if (h === 'localhost') return false;
	if (/^127\./.test(h)) return false;

	// IPv4 private ranges
	if (/^10\./.test(h)) return false;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
	if (/^192\.168\./.test(h)) return false;

	// IPv4 link-local / IANA special-use
	if (/^169\.254\./.test(h)) return false;
	if (/^0\./.test(h)) return false;

	// IPv6 loopback: ::1 (WHATWG URL API includes brackets in hostname)
	if (h === '[::1]') return false;

	// IPv6 link-local: fe80::/10 (fe80–febf)
	if (/^\[fe[89ab]/i.test(h)) return false;

	// IPv6 unique-local: fc00::/7 (fc00–fdff)
	if (/^\[f[cd]/i.test(h)) return false;

	// IPv4-mapped IPv6: ::ffff:x.x.x.x
	if (/^\[::ffff:/i.test(h)) return false;

	return true;
}
