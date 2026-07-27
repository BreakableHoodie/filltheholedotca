import { test, expect } from '@playwright/test';
import groundTruth from '../fixtures/ground-truth.json' with { type: 'json' };

const { insideWaterlooRegion, outsideWaterlooRegion } = groundTruth.geofence;

// These tests call the API directly using Playwright's request fixture, which acts
// as a standalone HTTP client. The geofence check in /api/report runs before any
// DB query (see src/routes/api/report/+server.ts), so both branches are fully
// deterministic even with placeholder Supabase credentials: rejections always
// return 422 before the DB is ever touched, and — because the Playwright preview
// server always runs with PLAYWRIGHT_E2E_FIXTURES=true (see playwright.config.ts) —
// passing reports are served entirely from the in-memory fixture store and always
// succeed with 200.
test.describe('Geofence API validation', () => {
	for (const point of outsideWaterlooRegion) {
		test(`rejects coordinates outside Waterloo Region (${point.label})`, async ({
			request,
		}) => {
			const response = await request.post('/api/report', {
				data: { lat: point.lat, lng: point.lng },
			});

			expect(response.status()).toBe(422);
			const body = await response.json();
			expect(body.message).toMatch(/isn't in the Waterloo Region/i);
		});
	}

	for (const point of insideWaterlooRegion) {
		test(`passes geofence for coordinates inside Waterloo Region (${point.label})`, async ({
			request,
		}) => {
			const response = await request.post('/api/report', {
				data: { lat: point.lat, lng: point.lng },
			});

			expect(response.status()).toBe(200);
			const body = await response.json();
			expect(body.message).not.toMatch(/isn't in the Waterloo Region/i);
		});
	}

	test('rejects request missing lat and lng', async ({ request }) => {
		const response = await request.post('/api/report', {
			data: { address: 'Some address', description: 'Test' },
		});

		// zod fails before the geofence check or any DB access, so this is a
		// deterministic 400 regardless of environment.
		expect(response.status()).toBe(400);
	});

	test('rejects request with non-numeric coordinates', async ({ request }) => {
		const response = await request.post('/api/report', {
			data: { lat: 'not-a-number', lng: -80.5 },
		});

		// zod's z.number() rejects a string before the geofence check or any
		// DB access, so this is a deterministic 400 regardless of environment.
		expect(response.status()).toBe(400);
	});
});
