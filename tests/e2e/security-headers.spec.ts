import { test, expect } from '@playwright/test';

/**
 * Security header regression tests.
 *
 * These assertions verify that hooks.server.ts applies the correct security
 * headers to every HTML response. The tests use a standard page route (/about)
 * which reliably returns HTML in both dev and production builds.
 *
 * If any of these fail after a refactor, check applySecurityHeaders() in
 * hooks.server.ts and verify it is called on all code paths including early
 * returns (401, 403, 413).
 */

test.describe('Security headers — HTML page responses', () => {
	let headers: Record<string, string>;

	test.beforeAll(async ({ request }) => {
		const response = await request.get('/about');
		headers = response.headers();
	});

	test('X-Frame-Options is DENY', async () => {
		expect(headers['x-frame-options']).toBe('DENY');
	});

	test('X-Content-Type-Options is nosniff', async () => {
		expect(headers['x-content-type-options']).toBe('nosniff');
	});

	test('Referrer-Policy is strict-origin-when-cross-origin', async () => {
		expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	});

	test('Strict-Transport-Security includes preload directive', async () => {
		const hsts = headers['strict-transport-security'] ?? '';
		expect(hsts).toContain('max-age=63072000');
		expect(hsts).toContain('includeSubDomains');
		expect(hsts).toContain('preload');
	});

	test('Permissions-Policy restricts camera, microphone, payment', async () => {
		const policy = headers['permissions-policy'] ?? '';
		expect(policy).toContain('camera=()');
		expect(policy).toContain('microphone=()');
		expect(policy).toContain('payment=()');
	});

	test('Cross-Origin-Opener-Policy is same-origin', async () => {
		expect(headers['cross-origin-opener-policy']).toBe('same-origin');
	});

	test('Cross-Origin-Resource-Policy is same-site on HTML pages', async () => {
		expect(headers['cross-origin-resource-policy']).toBe('same-site');
	});
});

test.describe('Security headers — API responses', () => {
	test('JSON API endpoints also carry security headers', async ({ request }) => {
		// Geofence-rejected report — fast to execute, exercises the early-return path
		const response = await request.post('/api/report', {
			data: { lat: 99, lng: 99, description: 'test' }
		});
		const h = response.headers();
		expect(h['x-frame-options']).toBe('DENY');
		expect(h['x-content-type-options']).toBe('nosniff');
	});

	test('open data feed carries cross-origin resource policy for cross-origin access', async ({
		request
	}) => {
		const response = await request.get('/api/feed.json');
		// Feed endpoint opts out of same-site CORP so data consumers can fetch it cross-origin
		const corp = response.headers()['cross-origin-resource-policy'];
		// Either explicitly cross-origin or absent (browser default allows cross-origin reads for JSON)
		expect(['cross-origin', undefined, '']).toContain(corp);
	});
});
