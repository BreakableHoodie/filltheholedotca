import { expect, test } from '@playwright/test';

// Schema validation tests — these verify the zod layer rejects bad input before
// any DB interaction, so the "rejects" tests work with placeholder Supabase
// credentials and assert an exact 400.
//
// The "valid input" tests confirm schema acceptance, but several of these
// routes touch the DB on their very first operation after validation passes
// (a persistent rate-limit check, or a direct read) — see the route handlers
// under src/routes/api/. In this test environment PUBLIC_SUPABASE_URL defaults
// to a closed port (see playwright.config.ts), so that DB call fails and the
// route deterministically returns 500. Asserting that exact 500 (rather than
// merely "not 400") still catches a real regression — e.g. the DB call
// silently swallowing its error and falling through to a 200/404.

test.describe('Polling API (/api/potholes/recent)', () => {
	test('returns empty array when since param is missing', async ({ request }) => {
		const response = await request.get('/api/potholes/recent');
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(Array.isArray(body.potholes)).toBe(true);
		expect(body.potholes).toHaveLength(0);
	});

	test('returns empty array when since param is not a valid date', async ({ request }) => {
		const response = await request.get('/api/potholes/recent?since=not-a-date');
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(Array.isArray(body.potholes)).toBe(true);
		expect(body.potholes).toHaveLength(0);
	});

	test('returns 200 with potholes array for a valid ISO date', async ({ request }) => {
		const response = await request.get('/api/potholes/recent?since=2020-01-01T00:00:00.000Z');
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(Array.isArray(body.potholes)).toBe(true);
	});
});

test.describe('Watchlist API (/api/watchlist)', () => {
	test('rejects request with no ids param', async ({ request }) => {
		const response = await request.get('/api/watchlist');
		expect(response.status()).toBe(400);
	});

	test('rejects a non-UUID id', async ({ request }) => {
		const response = await request.get('/api/watchlist?ids=not-a-uuid');
		expect(response.status()).toBe(400);
	});

	test('rejects more than 50 ids', async ({ request }) => {
		const ids = Array.from(
			{ length: 51 },
			(_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
		).join(',');
		const response = await request.get(`/api/watchlist?ids=${ids}`);
		expect(response.status()).toBe(400);
	});

	test('accepts valid UUIDs — zod passes; the DB read fails without a live Supabase connection', async ({
		request,
	}) => {
		const response = await request.get(
			'/api/watchlist?ids=550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001',
		);
		expect(response.status()).toBe(500);
	});
});

test.describe('Filled API — status guard', () => {
	test('accepts a valid UUID — zod passes; the fill-rate-limit DB check fails without a live connection', async ({
		request,
	}) => {
		const response = await request.post('/api/filled', {
			data: { id: '550e8400-e29b-41d4-a716-446655440002' },
		});
		expect(response.status()).toBe(500);
	});
});

test.describe('OG image API (/api/og/[id])', () => {
	test('rejects a non-UUID id with 400', async ({ request }) => {
		const response = await request.get('/api/og/not-a-uuid');
		expect(response.status()).toBe(400);
	});

	test('accepts a valid UUID format — zod passes; the DB read fails without a live Supabase connection', async ({
		request,
	}) => {
		const response = await request.get('/api/og/550e8400-e29b-41d4-a716-446655440000');
		expect(response.status()).toBe(500);
	});
});

test.describe('Ward notify API (/api/notify/ward)', () => {
	test('ward subscribe rejects unknown ward_key', async ({ request }) => {
		const response = await request.post('/api/notify/ward', {
			data: {
				ward_key: 'kitchener-99',
				endpoint: 'https://example.com/x',
				keys: { p256dh: 'a', auth: 'b' },
			},
		});
		expect(response.status()).toBe(400);
	});

	test('ward subscribe accepts a known ward_key — validation passes; the rate-limit DB check fails without a live connection', async ({
		request,
	}) => {
		const response = await request.post('/api/notify/ward', {
			data: {
				ward_key: 'kitchener-6',
				endpoint: 'https://fcm.googleapis.com/x',
				keys: { p256dh: 'a', auth: 'b' },
			},
		});
		expect(response.status()).toBe(500);
	});
});

test.describe('Vote API (/api/vote)', () => {
	test('accepts a valid UUID with an upvote direction — zod passes; the rate-limit DB check fails without a live connection', async ({
		request,
	}) => {
		const response = await request.post('/api/vote', {
			data: { id: '550e8400-e29b-41d4-a716-446655440003', direction: 1 },
		});
		expect(response.status()).toBe(500);
	});

	test('rejects an invalid direction', async ({ request }) => {
		const response = await request.post('/api/vote', {
			data: { id: '550e8400-e29b-41d4-a716-446655440003', direction: 2 },
		});
		expect(response.status()).toBe(400);
	});

	test('rejects a non-UUID id', async ({ request }) => {
		const response = await request.post('/api/vote', {
			data: { id: 'not-a-uuid', direction: 1 },
		});
		expect(response.status()).toBe(400);
	});
});

test.describe('Filled API (/api/filled)', () => {
	test('rejects request with missing id', async ({ request }) => {
		const response = await request.post('/api/filled', { data: {} });
		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.message).toMatch(/Invalid request/i);
	});

	test('rejects request with a non-UUID id', async ({ request }) => {
		const response = await request.post('/api/filled', {
			data: { id: 'not-a-uuid' },
		});
		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.message).toMatch(/Invalid request/i);
	});

	test('accepts a valid UUID — zod validation passes; the fill-rate-limit DB check fails without a live connection', async ({
		request,
	}) => {
		const response = await request.post('/api/filled', {
			data: { id: '550e8400-e29b-41d4-a716-446655440001' },
		});
		expect(response.status()).toBe(500);
	});
});
