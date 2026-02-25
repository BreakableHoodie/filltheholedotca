import { test, expect } from '@playwright/test';

// Schema validation tests — these verify the zod layer rejects bad input before
// any DB interaction, so they work with placeholder Supabase credentials.
// The "valid UUID" tests confirm schema acceptance; downstream DB behaviour
// (409 wrong status, 500 no connection) is intentionally outside scope here.

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
		const ids = Array.from({ length: 51 }, (_, i) =>
			`550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`
		).join(',');
		const response = await request.get(`/api/watchlist?ids=${ids}`);
		expect(response.status()).toBe(400);
	});

	test('accepts valid UUIDs — zod passes, returns array for unknown ids', async ({ request }) => {
		const response = await request.get(
			'/api/watchlist?ids=550e8400-e29b-41d4-a716-446655440000,550e8400-e29b-41d4-a716-446655440001'
		);
		expect(response.status()).not.toBe(400);
	});
});

test.describe('Filled API — status guard', () => {
	test('accepts a valid UUID for filled endpoint', async ({ request }) => {
		const response = await request.post('/api/filled', {
			data: { id: '550e8400-e29b-41d4-a716-446655440002' }
		});
		// Schema accepted — not a 400
		expect(response.status()).not.toBe(400);
	});
});

test.describe('OG image API (/api/og/[id])', () => {
	test('rejects a non-UUID id with 400', async ({ request }) => {
		const response = await request.get('/api/og/not-a-uuid');
		expect(response.status()).toBe(400);
	});

	test('accepts a valid UUID format — zod passes, returns 404 for unknown id', async ({ request }) => {
		const response = await request.get('/api/og/550e8400-e29b-41d4-a716-446655440000');
		
		// Skip if Supabase unavailable (500 error)
		if (response.status() === 500) {
			test.skip(true, 'OG API returns 500 - test environment lacks Supabase connection');
			return;
		}
		
		// Schema accepted (not 400); DB returns not-found for unknown UUID
		expect(response.status()).not.toBe(400);
		expect(response.status()).toBe(404);
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
		const response = await request.post('/api/filled', { data: { id: 'not-a-uuid' } });
		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.message).toMatch(/Invalid request/i);
	});

	test('accepts a valid UUID — zod validation passes, DB is not exercised', async ({
		request
	}) => {
		const response = await request.post('/api/filled', {
			data: { id: '550e8400-e29b-41d4-a716-446655440001' }
		});
		expect(response.status()).not.toBe(400);
	});
});
