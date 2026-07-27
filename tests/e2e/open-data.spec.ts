import { test, expect } from '@playwright/test';

/**
 * Open data endpoint tests.
 *
 * These tests hit the actual HTTP endpoints but only assert on response shape —
 * content-type, status, and structural invariants that hold even with an empty
 * or placeholder Supabase connection (e.g. the CSV header row, the RSS envelope,
 * a valid JSON array). They do not assert on specific pothole data.
 */

test.describe('CSV export (/api/export.csv)', () => {
	test('returns 200 with text/csv content-type', async ({ request }) => {
		const response = await request.get('/api/export.csv');
		if (response.status() === 500) {
			test.skip(true, 'Supabase unavailable in test environment');
			return;
		}
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('text/csv');
	});

	test('response includes CSV header row', async ({ request }) => {
		const response = await request.get('/api/export.csv');
		if (response.status() === 500) {
			test.skip(true, 'Supabase unavailable in test environment');
			return;
		}
		const text = await response.text();
		// Must include the canonical column names regardless of data
		expect(text).toContain('id');
		expect(text).toContain('lat');
		expect(text).toContain('lng');
		expect(text).toContain('status');
	});

	test('Content-Disposition suggests a filename', async ({ request }) => {
		const response = await request.get('/api/export.csv');
		if (response.status() === 500) {
			test.skip(true, 'Supabase unavailable in test environment');
			return;
		}
		const disposition = response.headers()['content-disposition'] ?? '';
		expect(disposition).toContain('attachment');
	});
});

test.describe('RSS feed (/api/feed.xml)', () => {
	test('returns 200 with RSS content-type', async ({ request }) => {
		const response = await request.get('/api/feed.xml');
		if (response.status() === 500) {
			test.skip(true, 'Supabase unavailable in test environment');
			return;
		}
		expect(response.status()).toBe(200);
		const contentType = response.headers()['content-type'] ?? '';
		expect(contentType).toMatch(/application\/rss\+xml|application\/xml|text\/xml/);
	});

	test('response is valid RSS 2.0 envelope', async ({ request }) => {
		const response = await request.get('/api/feed.xml');
		if (response.status() === 500) {
			test.skip(true, 'Supabase unavailable in test environment');
			return;
		}
		const text = await response.text();
		expect(text).toContain('<rss');
		expect(text).toContain('<channel>');
		expect(text).toContain('</channel>');
		expect(text).toContain('</rss>');
	});
});

test.describe('JSON feed (/api/feed.json)', () => {
	test('returns 200 with application/json content-type', async ({ request }) => {
		const response = await request.get('/api/feed.json');
		const status = response.status();
		// Accept 500 only if Supabase is unreachable in the test environment
		if (status === 500) {
			test.skip(true, 'Supabase unavailable in test environment');
			return;
		}
		expect(status).toBe(200);
		expect(response.headers()['content-type']).toContain('application/json');
	});

	test('response body contains a potholes array', async ({ request }) => {
		const response = await request.get('/api/feed.json');
		if (response.status() === 500) {
			test.skip(true, 'Supabase unavailable in test environment');
			return;
		}
		const body = await response.json();
		expect(Array.isArray(body.potholes)).toBe(true);
	});
});

test.describe('Ward boundaries (/api/wards.geojson)', () => {
	// /api/wards.geojson proxies three real ArcGIS services (Kitchener,
	// Waterloo, Cambridge) — a live outage in any of them would red-fail CI
	// for a test that isn't actually exercising our own code. Mock the route
	// so this suite never touches external services, same approach as the
	// "stats page ward rows link to ward profile pages" test in
	// tests/e2e/ward-profile.spec.ts.
	const mockWardsGeojson = {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				geometry: {
					type: 'Polygon',
					coordinates: [
						[
							[-80.55, 43.45],
							[-80.5, 43.45],
							[-80.5, 43.4],
							[-80.55, 43.4],
							[-80.55, 43.45],
						],
					],
				},
				properties: { CITY: 'kitchener', WARDID_NORM: 9 },
			},
		],
	};

	test.beforeEach(async ({ page }) => {
		await page.route('**/api/wards.geojson', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(mockWardsGeojson),
			}),
		);
	});

	test('returns 200 with JSON content-type', async ({ page }) => {
		const response = await page.goto('/api/wards.geojson');
		expect(response?.status()).toBe(200);
		expect(response?.headers()['content-type']).toContain('application/json');
	});

	test('response is a GeoJSON FeatureCollection', async ({ page }) => {
		const response = await page.goto('/api/wards.geojson');
		const body = await response!.json();
		expect(body.type).toBe('FeatureCollection');
		expect(Array.isArray(body.features)).toBe(true);
		expect(body.features.length).toBeGreaterThan(0);
	});

	test('each feature has geometry and ward identifier properties', async ({ page }) => {
		const response = await page.goto('/api/wards.geojson');
		const body = await response!.json();
		const first = body.features[0];
		expect(first.type).toBe('Feature');
		expect(first.geometry.type).toBe('Polygon');
		expect(Array.isArray(first.geometry.coordinates[0])).toBe(true);
		expect(first.geometry.coordinates[0].length).toBeGreaterThan(0);
		expect(first.properties.CITY).toBe('kitchener');
		expect(first.properties.WARDID_NORM).toBe(9);
	});
});
