import { expect, test } from '@playwright/test';

// Schema validation tests for Phase 6 API endpoints.
// These verify zod rejects bad input before any DB interaction, so the
// "rejects" tests work with placeholder Supabase credentials and assert an
// exact 400.
//
// The "accepts" tests confirm schema acceptance, but each of these routes
// touches the DB on its first operation after validation passes (a
// persistent rate-limit check) — see the route handlers under
// src/routes/api/. In this test environment PUBLIC_SUPABASE_URL defaults to a
// closed port (see playwright.config.ts), so that DB call fails and the route
// deterministically returns 500. Asserting that exact 500 (rather than merely
// "not 400") still catches a real regression.

test.describe('Hit API (/api/hit)', () => {
	test('rejects request with missing id', async ({ request }) => {
		const response = await request.post('/api/hit', { data: {} });
		expect(response.status()).toBe(400);
	});

	test('rejects a non-UUID id', async ({ request }) => {
		const response = await request.post('/api/hit', {
			data: { id: 'not-a-uuid' },
		});
		expect(response.status()).toBe(400);
	});

	test('rejects a malformed JSON body', async ({ request }) => {
		const response = await request.post('/api/hit', {
			headers: { 'Content-Type': 'application/json' },
			data: 'not-json',
		});
		expect(response.status()).toBe(400);
	});

	test('accepts a valid UUID — zod passes; the rate-limit DB check fails without a live connection', async ({
		request,
	}) => {
		const response = await request.post('/api/hit', {
			data: { id: '550e8400-e29b-41d4-a716-446655440000' },
		});
		expect(response.status()).toBe(500);
	});
});

test.describe('Subscribe API — POST (/api/subscribe)', () => {
	test('rejects request with missing endpoint', async ({ request }) => {
		const response = await request.post('/api/subscribe', {
			data: { keys: { p256dh: 'abc', auth: 'xyz' } },
		});
		expect(response.status()).toBe(400);
	});

	test('rejects a non-URL endpoint', async ({ request }) => {
		const response = await request.post('/api/subscribe', {
			data: {
				endpoint: 'not-a-url',
				keys: { p256dh: 'abc', auth: 'xyz' },
			},
		});
		expect(response.status()).toBe(400);
	});

	test('rejects endpoint exceeding 2048 characters', async ({ request }) => {
		const response = await request.post('/api/subscribe', {
			data: {
				endpoint: `https://push.example.com/${'a'.repeat(2040)}`,
				keys: { p256dh: 'abc', auth: 'xyz' },
			},
		});
		expect(response.status()).toBe(400);
	});

	test('rejects missing keys object', async ({ request }) => {
		const response = await request.post('/api/subscribe', {
			data: { endpoint: 'https://push.example.com/abc123' },
		});
		expect(response.status()).toBe(400);
	});

	test('rejects missing keys.p256dh', async ({ request }) => {
		const response = await request.post('/api/subscribe', {
			data: {
				endpoint: 'https://push.example.com/abc123',
				keys: { auth: 'xyz' },
			},
		});
		expect(response.status()).toBe(400);
	});

	test('rejects missing keys.auth', async ({ request }) => {
		const response = await request.post('/api/subscribe', {
			data: {
				endpoint: 'https://push.example.com/abc123',
				keys: { p256dh: 'abc' },
			},
		});
		expect(response.status()).toBe(400);
	});

	test('accepts a valid subscription — zod passes; the rate-limit DB check fails without a live connection', async ({
		request,
	}) => {
		const response = await request.post('/api/subscribe', {
			data: {
				endpoint: 'https://push.example.com/abc123',
				keys: { p256dh: 'dGVzdA==', auth: 'dGVzdA==' },
			},
		});
		expect(response.status()).toBe(500);
	});
});

test.describe('Subscribe API — DELETE (/api/subscribe)', () => {
	test('rejects request with missing endpoint', async ({ request }) => {
		const response = await request.delete('/api/subscribe', { data: {} });
		expect(response.status()).toBe(400);
	});

	test('rejects a non-URL endpoint', async ({ request }) => {
		const response = await request.delete('/api/subscribe', {
			data: { endpoint: 'not-a-url' },
		});
		expect(response.status()).toBe(400);
	});

	test('accepts a valid endpoint — zod passes; the rate-limit DB check fails without a live connection', async ({
		request,
	}) => {
		const response = await request.delete('/api/subscribe', {
			data: { endpoint: 'https://push.example.com/abc123' },
		});
		expect(response.status()).toBe(500);
	});
});

test.describe('Embed widget (/api/embed/[id])', () => {
	test('returns 404 for an unknown pothole UUID', async ({ request }) => {
		const response = await request.get('/api/embed/550e8400-e29b-41d4-a716-446655440000');
		// DB returns null for unknown UUID → 404 (even without connection, data is null)
		expect(response.status()).toBe(404);
	});

	test('rejects a non-UUID id with 400 before any DB lookup', async ({ request }) => {
		// This previously asserted 404, but 'not-a-uuid' fails the zod
		// `z.string().uuid()` check in src/routes/api/embed/[id]/+server.ts
		// before the handler ever queries Supabase — that's a 400 in every
		// environment, not a DB-dependent 404 (that assertion could never have
		// passed against the real route).
		const response = await request.get('/api/embed/not-a-uuid');
		expect(response.status()).toBe(400);
	});

	test('does NOT set X-Frame-Options on the embed route', async ({ request }) => {
		// The hook skips X-Frame-Options for /api/embed/* to allow iframe embedding.
		// This is intentional — even error responses should not block framing.
		const response = await request.get('/api/embed/550e8400-e29b-41d4-a716-446655440000');
		expect(response.headers()['x-frame-options']).toBeUndefined();
	});
});
