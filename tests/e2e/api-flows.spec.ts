import { test, expect } from '@playwright/test';

// Schema validation tests — these verify the zod layer rejects bad input before
// any DB interaction, so they work with placeholder Supabase credentials.
// The "valid UUID" tests confirm schema acceptance; downstream DB behaviour
// (409 wrong status, 500 no connection) is intentionally outside scope here.

test.describe('Wanksy API — removed', () => {
	test('/api/wanksy returns 404 after removal', async ({ request }) => {
		const response = await request.post('/api/wanksy', {
			data: { id: '550e8400-e29b-41d4-a716-446655440000' }
		});
		expect(response.status()).toBe(404);
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
