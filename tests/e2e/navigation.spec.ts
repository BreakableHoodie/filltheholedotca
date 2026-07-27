import { expect, test } from '@playwright/test';

test.describe('Navigation — core routes load', () => {
	test.use({
		storageState: {
			cookies: [],
			origins: [
				{
					origin: 'http://localhost:4173',
					localStorage: [{ name: 'fth-home-intro-dismissed', value: '1' }],
				},
			],
		},
	});

	test('home page loads with map heading and nav', async ({ page }) => {
		await page.goto('/');

		await expect(page).toHaveTitle(/FillTheHole\.ca/i);
		await expect(page.getByRole('navigation')).toBeVisible();
		await expect(page.getByRole('main')).toBeVisible();
	});

	test('about page loads with correct heading', async ({ page }) => {
		await page.goto('/about');

		await expect(page).toHaveTitle(/About/i);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('report page loads with correct heading', async ({ page }) => {
		await page.goto('/report');

		await expect(page).toHaveTitle(/Report a pothole/i);
		await expect(
			page.getByRole('heading', { level: 1, name: /Report a pothole/i }),
		).toBeVisible();
	});

	test('stats page loads with correct heading', async ({ page }) => {
		await page.goto('/stats');

		await expect(page).toHaveTitle(/Stats/i);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('nav link to stats works', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Stats' }).click();
		await expect(page).toHaveURL('/stats');
	});

	test('nav link to about works', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'About' }).click();
		await expect(page).toHaveURL('/about');
	});

	test('nav report button navigates to report page', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: /Report a pothole/i }).click();
		await expect(page).toHaveURL('/report');
	});

	test('logo link navigates home', async ({ page }) => {
		await page.goto('/about');
		// Use the header logo link specifically — the about page also has a GitHub
		// link whose text "BreakableHoodie/filltheholedotca" matches /FillTheHole/i
		await page
			.locator('header')
			.getByRole('link', { name: /FillTheHole/i })
			.click();
		await expect(page).toHaveURL('/');
	});

	test('footer privacy link navigates to the privacy policy', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Privacy' }).click();
		await expect(page).toHaveURL('/privacy');
	});

	test('footer terms link navigates to the terms page', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Terms' }).click();
		await expect(page).toHaveURL('/terms');
	});

	test('skip link is the first focusable element and points to #maincontent', async ({
		page,
	}) => {
		await page.goto('/');
		await page.keyboard.press('Tab');
		const focused = page.locator(':focus');
		await expect(focused).toHaveAttribute('href', '#maincontent');
	});
});

test.describe('Feed API', () => {
	// /api/feed.json queries Supabase directly (no fixture branch). In this test
	// environment PUBLIC_SUPABASE_URL defaults to a closed port (see
	// playwright.config.ts), so the query fails and the route deterministically
	// returns 500 (see src/routes/api/feed.json/+server.ts) — asserting on that
	// wouldn't verify anything about the real feed shape this test exists to
	// check. PUBLIC_SUPABASE_URL tells us honestly whether a real connection was
	// supplied for this run.
	//
	// Note it is read directly rather than via playwright.config.ts's
	// SUPABASE_CONFIGURED: that is set under `webServer.env`, so it reaches the
	// server process only and is always undefined here in the test runner.
	// See open-data.spec.ts.
	const supabaseConfigured = process.env.PUBLIC_SUPABASE_URL?.startsWith('http') ?? false;

	test('GET /api/feed.json returns valid JSON array', async ({ request }) => {
		test.skip(
			!supabaseConfigured,
			'Requires a live Supabase connection (set PUBLIC_SUPABASE_URL)',
		);

		const response = await request.get('/api/feed.json');
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toMatch(/json/);
		const body = await response.json();
		expect(Array.isArray(body.potholes)).toBe(true);
	});

	// /api/wards.geojson intentionally has no test here. It proxies three live
	// ArcGIS services and returns 502 when all are down with no cache, so a
	// direct request would red-fail CI on an upstream outage rather than an
	// application regression. open-data.spec.ts covers the same endpoint with a
	// page.route() mock and stronger structural assertions — adding bounded
	// retries here would only reintroduce the failure-masking this suite just
	// removed.
});
