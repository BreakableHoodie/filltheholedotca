import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';

// In-memory rate limit store: ip -> { count, resetAt }
// NOTE: on Netlify serverless this resets per cold start — it's a deterrent, not a wall.
// For persistent rate limiting, use Upstash Redis (@upstash/ratelimit) or a Supabase
// rate_limits table. See docs/code-review/2026-02-22-api-security-review.md (M-03).
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // requests per window per IP

function checkRateLimit(ip: string): void {
	const now = Date.now();
	const entry = rateLimitStore.get(ip);

	if (!entry || now > entry.resetAt) {
		rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return;
	}

	if (entry.count >= RATE_LIMIT_MAX) {
		throw error(429, 'Too many requests. Please wait a minute.');
	}

	entry.count++;
}

// Prune expired entries every 5 minutes to prevent memory growth
setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of rateLimitStore) {
		if (now > entry.resetAt) rateLimitStore.delete(ip);
	}
}, 5 * 60_000);

export const handle: Handle = async ({ event, resolve }) => {
	// www → non-www redirect
	if (event.url.hostname.startsWith('www.')) {
		const url = new URL(event.url);
		url.hostname = url.hostname.slice(4);
		throw redirect(301, url.toString());
	}

	// Rate limit all /api/* routes
	if (event.url.pathname.startsWith('/api/')) {
		const ip = event.getClientAddress();
		checkRateLimit(ip);
	}

	const response = await resolve(event);

	// Security headers
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), payment=(), geolocation=(self)'
	);
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-* required by Vite/SvelteKit + Leaflet
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: https: blob:",
			"font-src 'self' data:",
			"connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org",
			"frame-ancestors 'none'"
		].join('; ')
	);

	return response;
};
