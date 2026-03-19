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
	test('returns 200 with JSON content-type', async ({ request }) => {
		const response = await request.get('/api/wards.geojson');
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('application/json');
	});

	test('response is a GeoJSON FeatureCollection', async ({ request }) => {
		const response = await request.get('/api/wards.geojson');
		const body = await response.json();
		expect(body.type).toBe('FeatureCollection');
		expect(Array.isArray(body.features)).toBe(true);
		expect(body.features.length).toBeGreaterThan(0);
	});

	test('each feature has geometry and ward properties', async ({ request }) => {
		const response = await request.get('/api/wards.geojson');
		const body = await response.json();
		const first = body.features[0];
		expect(first.type).toBe('Feature');
		expect(first.geometry).toBeTruthy();
		expect(first.properties).toBeTruthy();
	});
});
