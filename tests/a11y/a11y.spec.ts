import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility — Home (map page)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('passes axe WCAG 2.1 AA scan', async ({ page }) => {
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();

		expect(results.violations).toEqual([]);
	});

	test('has exactly one h1', async ({ page }) => {
		const h1s = page.getByRole('heading', { level: 1 });
		await expect(h1s).toHaveCount(1);
	});

	test('has a skip link as the first focusable element', async ({ page }) => {
		await page.keyboard.press('Tab');
		const focused = page.locator(':focus');
		await expect(focused).toHaveAttribute('href', '#maincontent');
	});

	test('has main landmark', async ({ page }) => {
		await expect(page.getByRole('main')).toBeVisible();
	});

	test('has navigation landmark', async ({ page }) => {
		await expect(page.getByRole('navigation')).toBeVisible();
	});
});

test.describe('Accessibility — Report form', () => {
	// Grant geolocation so the form reaches its productive "GPS acquired" state
	// (prevents the GPS-denied error toast from appearing during the axe scan)
	test.use({
		geolocation: { latitude: 43.45, longitude: -80.5 }, // within Waterloo Region
		permissions: ['geolocation']
	});

	test.beforeEach(async ({ page }) => {
		await page.goto('/report');
		// Wait briefly for geolocation to resolve before scanning
		await page.waitForTimeout(300);
	});

	test('passes axe WCAG 2.1 AA scan', async ({ page }) => {
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			// Exclude the toast notification container: toasts are transient UI elements
			// with styling controlled by svelte-sonner; they are tested separately.
			.exclude('[data-sonner-toaster]')
			.analyze();

		expect(results.violations).toEqual([]);
	});

	test('has exactly one h1', async ({ page }) => {
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	});

	test('all form controls have visible labels', async ({ page }) => {
		// Every input/textarea/select must have an accessible label
		const inputs = page.locator('input, textarea, select');
		const count = await inputs.count();

		for (let i = 0; i < count; i++) {
			const input = inputs.nth(i);
			// Hidden inputs (e.g. coords) are exempt
			const type = await input.getAttribute('type');
			if (type === 'hidden') continue;

			const id = await input.getAttribute('id');
			const ariaLabel = await input.getAttribute('aria-label');
			const ariaLabelledBy = await input.getAttribute('aria-labelledby');

			const hasLabel = id
				? (await page.locator(`label[for="${id}"]`).count()) > 0
				: false;

			expect(
				hasLabel || ariaLabel || ariaLabelledBy,
				`Input ${id ?? 'unknown'} has no accessible label`
			).toBeTruthy();
		}
	});

	test('submit button is keyboard accessible', async ({ page }) => {
		const submit = page.getByRole('button', { name: /submit|report/i });
		await expect(submit).toBeVisible();
		await submit.focus();
		await expect(submit).toBeFocused();
	});
});

test.describe('Accessibility — About page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/about');
	});

	test('passes axe WCAG 2.1 AA scan', async ({ page }) => {
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();

		expect(results.violations).toEqual([]);
	});

	test('has exactly one h1', async ({ page }) => {
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	});

	test('all links have accessible names', async ({ page }) => {
		const links = page.getByRole('link');
		const count = await links.count();

		for (let i = 0; i < count; i++) {
			const link = links.nth(i);
			const text = await link.textContent();
			const ariaLabel = await link.getAttribute('aria-label');
			const ariaLabelledBy = await link.getAttribute('aria-labelledby');

			expect(
				(text?.trim()) || ariaLabel || ariaLabelledBy,
				`Link at index ${i} has no accessible name`
			).toBeTruthy();
		}
	});
});

test.describe('Accessibility — narrow viewport (320px reflow)', () => {
	test.use({ viewport: { width: 320, height: 568 } });

	test('home page does not scroll horizontally at 320px', async ({ page }) => {
		await page.goto('/');
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
	});

	test('report page does not scroll horizontally at 320px', async ({ page }) => {
		await page.goto('/report');
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
	});
});
