import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// In-memory coarse rate limit store: ip -> { count, resetAt }.
// NOTE: on Netlify serverless this resets per cold start — treat it as a broad deterrent.
// Route-specific persistent throttles are enforced in API handlers via DB-backed checks.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // requests per window per IP
const DISABLE_API_RATE_LIMIT = env.DISABLE_API_RATE_LIMIT === 'true';

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

	// Rate limit all /api/* routes unless explicitly disabled for test runs.
	if (!DISABLE_API_RATE_LIMIT && event.url.pathname.startsWith('/api/')) {
		const ip = event.getClientAddress();
		checkRateLimit(ip);
	}

	const response = await resolve(event);

	// Security headers
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), payment=(), geolocation=(self)'
	);
	// H4: Removed 'unsafe-eval' (not required by SvelteKit/Svelte 5/Leaflet in production).
	// Tightened img-src from wildcard https: to specific origins.
	// Allow Google Fonts stylesheet/font origins currently used by src/app.css.
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org",
			"font-src 'self' data: https://fonts.gstatic.com",
			"connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org",
			"frame-ancestors 'none'"
		].join('; ')
	);
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

	return response;
};
