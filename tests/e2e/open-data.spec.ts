import { test, expect } from '@playwright/test';

/**
 * Open data endpoint tests.
 *
 * CSV export, RSS feed, and JSON feed all query Supabase directly (no fixture
 * branch — see src/routes/api/export.csv, /api/feed.xml, /api/feed.json). In
 * this test environment PUBLIC_SUPABASE_URL defaults to a closed port (see
 * playwright.config.ts), so those queries fail and every one of these routes
 * deterministically returns 500 — asserting that 500 would not tell us
 * anything about the real "open data" contract these tests exist to check
 * (correct CSV columns, a well-formed RSS envelope, a `potholes` array).
 *
 * SUPABASE_CONFIGURED (also set in playwright.config.ts) tells us honestly
 * whether a real PUBLIC_SUPABASE_URL was supplied for this run. When it
 * wasn't, skip the whole block rather than accepting whatever status code the
 * closed-port fallback happens to produce.
 */
// Derived from PUBLIC_SUPABASE_URL, not SUPABASE_CONFIGURED. The latter is set in
// playwright.config.ts under `webServer.env`, which reaches the *server* process
// only — this file runs in the *test runner* process, where it is always
// undefined. Reading it here made the gate permanently false even when real
// credentials were supplied: exactly the silent skip this gate exists to prevent.
const supabaseConfigured = process.env.PUBLIC_SUPABASE_URL?.startsWith('http') ?? false;

test.describe('CSV export (/api/export.csv)', () => {
	test.skip(!supabaseConfigured, 'Requires a live Supabase connection (SUPABASE_CONFIGURED)');

	test('returns 200 with text/csv content-type', async ({ request }) => {
		const response = await request.get('/api/export.csv');
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('text/csv');
	});

	test('response includes CSV header row', async ({ request }) => {
		const response = await request.get('/api/export.csv');
		const text = await response.text();
		// Must include the canonical column names regardless of data
		expect(text).toContain('id');
		expect(text).toContain('lat');
		expect(text).toContain('lng');
		expect(text).toContain('status');
	});

	test('Content-Disposition suggests a filename', async ({ request }) => {
		const response = await request.get('/api/export.csv');
		const disposition = response.headers()['content-disposition'] ?? '';
		expect(disposition).toContain('attachment');
	});
});

test.describe('RSS feed (/api/feed.xml)', () => {
	test.skip(!supabaseConfigured, 'Requires a live Supabase connection (SUPABASE_CONFIGURED)');

	test('returns 200 with RSS content-type', async ({ request }) => {
		const response = await request.get('/api/feed.xml');
		expect(response.status()).toBe(200);
		const contentType = response.headers()['content-type'] ?? '';
		expect(contentType).toMatch(/application\/rss\+xml|application\/xml|text\/xml/);
	});

	test('response is valid RSS 2.0 envelope', async ({ request }) => {
		const response = await request.get('/api/feed.xml');
		const text = await response.text();
		expect(text).toContain('<rss');
		expect(text).toContain('<channel>');
		expect(text).toContain('</channel>');
		expect(text).toContain('</rss>');
	});
});

test.describe('JSON feed (/api/feed.json)', () => {
	test.skip(!supabaseConfigured, 'Requires a live Supabase connection (SUPABASE_CONFIGURED)');

	test('returns 200 with application/json content-type', async ({ request }) => {
		const response = await request.get('/api/feed.json');
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('application/json');
	});

	test('response body contains a potholes array', async ({ request }) => {
		const response = await request.get('/api/feed.json');
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
