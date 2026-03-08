import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	validateAdminSession,
	checkSessionExpiry,
	touchSession,
	invalidateSession,
	SESSION_COOKIE
} from '$lib/server/admin-auth';
import { CSRF_HEADER, validateCsrfToken } from '$lib/server/admin-csrf';

// In-memory coarse rate limit store: ip -> { count, resetAt }.
// NOTE: on Netlify serverless this resets per cold start — treat it as a broad deterrent.
// Route-specific persistent throttles are enforced in API handlers via DB-backed checks.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // requests per window per IP
const DISABLE_API_RATE_LIMIT = env.DISABLE_API_RATE_LIMIT === 'true';
// H4: Refuse to start in a production deployment with rate-limiting disabled.
// DISABLE_API_RATE_LIMIT is strictly a test/dev convenience flag.
// CI is exempted: GitHub Actions sets process.env.CI='true'; Netlify production
// functions do not, so this guard fires only on real production deployments.
if (DISABLE_API_RATE_LIMIT && import.meta.env.PROD && !process.env.CI) {
	throw new Error('[hooks] DISABLE_API_RATE_LIMIT must not be set in production. Aborting startup.');
}

/** Apply the standard security header set to any Response, including early returns. */
function applySecurityHeaders(response: Response): Response {
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// L7: preload enables HSTS preload list submission (https://hstspreload.org).
	response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), payment=(), geolocation=(self)'
	);
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	// L8: Prevent cross-origin reads by default. Routes that intentionally expose
	// resources cross-origin (OG images, public feed) set Cross-Origin-Resource-Policy
	// on their own Response; this hook preserves those opt-out overrides by checking first.
	if (!response.headers.has('Cross-Origin-Resource-Policy')) {
		response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
	}
	return response;
}

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

	// -----------------------------------------------------------------------
	// Admin session enforcement
	// - /admin/* page routes → redirect to /admin/login on invalid session
	// - /api/admin/* routes  → return 401 JSON on invalid session
	// Auth endpoints are exempt from both.
	// -----------------------------------------------------------------------
	const { pathname } = event.url;
	const isAdminPage =
		pathname.startsWith('/admin') &&
		!pathname.startsWith('/admin/login') &&
		!pathname.startsWith('/admin/signup');
	const isAdminApi = pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth/');

	if (isAdminPage || isAdminApi) {
		const sessionId = event.cookies.get(SESSION_COOKIE) ?? null;
		let authed = false;

		if (sessionId) {
			const result = await validateAdminSession(sessionId);
			if (result) {
				const expiry = checkSessionExpiry(result.session, result.user.role);
				if (expiry) {
					// Session timed out — invalidate and fall through to reject
					await invalidateSession(sessionId);
					event.cookies.set(SESSION_COOKIE, '', {
						path: '/',
						expires: new Date(0),
						httpOnly: true,
						sameSite: 'strict'
					});
				} else {
					// Valid session — inject into locals and touch
					event.locals.adminUser = result.user;
					event.locals.adminSession = result.session;
					await touchSession(sessionId);
					authed = true;
				}
			}
		}

		if (!authed) {
			if (isAdminApi) {
				return applySecurityHeaders(
					new Response(JSON.stringify({ error: 'Unauthorized' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' }
					})
				);
			}
			const loginUrl = `/admin/login?next=${encodeURIComponent(pathname)}`;
			throw redirect(303, loginUrl);
		}

		// CSRF validation for state-changing admin API requests
		if (isAdminApi && !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
			const csrfHeader = event.request.headers.get(CSRF_HEADER);
			const csrfCookie = event.cookies.get('admin_csrf');
			if (
				!csrfHeader ||
				!csrfCookie ||
				csrfHeader !== csrfCookie ||
				!(await validateCsrfToken(sessionId!, csrfHeader))
			) {
				return applySecurityHeaders(
					new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' }
					})
				);
			}
		}
	}

	// L5: Best-effort early rejection of oversized photo uploads when Content-Length
	// is present. Clients using chunked transfer encoding bypass this check, so the
	// route still enforces a hard 5 MB limit on the parsed body. This guard reduces
	// unnecessary body buffering for well-behaved clients that include Content-Length.
	if (event.url.pathname === '/api/photos' && event.request.method === 'POST') {
		const cl = event.request.headers.get('content-length');
		if (cl && parseInt(cl, 10) > 6 * 1024 * 1024) {
			return applySecurityHeaders(
				new Response(JSON.stringify({ error: 'Request too large' }), {
					status: 413,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		}
	}

	const response = await resolve(event);

	// CSP is configured in svelte.config.js (csp.mode: 'nonce').
	// SvelteKit sets the header automatically on all HTML responses.
	return applySecurityHeaders(response);
};
