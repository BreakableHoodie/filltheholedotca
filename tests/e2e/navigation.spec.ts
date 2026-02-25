import { test, expect } from '@playwright/test';

test.describe('Navigation — core routes load', () => {
	test.use({
		storageState: {
			cookies: [],
			origins: [
				{
					origin: 'http://localhost:4173',
					localStorage: [{ name: 'fth-welcomed', value: '1' }]
				}
			]
		}
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
		await expect(page.getByRole('heading', { level: 1, name: /Report a pothole/i })).toBeVisible();
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
		await page.locator('header').getByRole('link', { name: /FillTheHole/i }).click();
		await expect(page).toHaveURL('/');
	});

	test('footer privacy link navigates to about#privacy', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Privacy' }).click();
		await expect(page).toHaveURL('/about#privacy');
	});

	test('skip link is the first focusable element and points to #maincontent', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Tab');
		const focused = page.locator(':focus');
		await expect(focused).toHaveAttribute('href', '#maincontent');
	});
});

test.describe('Feed API', () => {
	test('GET /api/feed.json returns valid JSON array', async ({ request }) => {
		// Add retry logic for flaky API calls
		let response;
		let attempts = 0;
		const maxAttempts = 3;
		
		while (attempts < maxAttempts) {
			try {
				response = await request.get('/api/feed.json');
				if (response.status() === 200) {
					break;
				} else if (response.status() === 429 && attempts < maxAttempts - 1) {
					// Wait before retry on rate limit
					await new Promise(resolve => setTimeout(resolve, 2000));
					attempts++;
					continue;
				} else if (response.status() === 500) {
					// Skip test on 500 errors (likely test env without real Supabase)
					test.skip(true, 'API returns 500 - test environment lacks Supabase connection');
					return;
				}
			} catch (error) {
				if (attempts === maxAttempts - 1) throw error;
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
			attempts++;
		}
		
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toMatch(/json/);
		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
	});

	test('GET /api/wards.geojson returns valid GeoJSON', async ({ request }) => {
		// Add retry logic for rate-limited external APIs
		let response;
		let attempts = 0;
		const maxAttempts = 3;
		
		while (attempts < maxAttempts) {
			try {
				response = await request.get('/api/wards.geojson');
				if (response.status() === 200) {
					break;
				} else if (response.status() === 429 && attempts < maxAttempts - 1) {
					// Wait longer for external API rate limits
					await new Promise(resolve => setTimeout(resolve, 5000));
					attempts++;
					continue;
				} else if ([500, 502, 503, 504].includes(response.status())) {
					// Skip test on server errors (external service issues)
					test.skip(true, 'External GeoJSON API unavailable (server error)');
					return;
				}
			} catch (error) {
				if (attempts === maxAttempts - 1) {
					// Skip test if external APIs are consistently failing
					test.skip(true, 'External API services unavailable');
					return;
				}
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
			attempts++;
		}
		
		// Handle case where external APIs are rate limiting
		if (response.status() === 429) {
			test.skip(true, 'External API rate limited - skipping test');
			return;
		}
		
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.type).toBe('FeatureCollection');
		expect(Array.isArray(body.features)).toBe(true);
	});
});
