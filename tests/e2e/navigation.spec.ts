import { test, expect } from '@playwright/test';

test.describe('Navigation — core routes load', () => {
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
		await page.getByRole('link', { name: /FillTheHole/i }).click();
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
		const response = await request.get('/api/feed.json');
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toMatch(/json/);
		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
	});

	test('GET /api/wards.geojson returns valid GeoJSON', async ({ request }) => {
		const response = await request.get('/api/wards.geojson');
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.type).toBe('FeatureCollection');
		expect(Array.isArray(body.features)).toBe(true);
	});
});
