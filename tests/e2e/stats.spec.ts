import { test, expect } from '@playwright/test';

test.describe('Stats page', () => {
	test.use({
		storageState: {
			cookies: [],
			origins: [
				{
					origin: 'http://localhost:4173',
					localStorage: [{ name: 'fth-home-intro-dismissed', value: '1' }]
				}
			]
		}
	});
	test.beforeEach(async ({ page }) => {
		await page.goto('/stats');
	});

	test('renders the main heading', async ({ page }) => {
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('has a time window filter group', async ({ page }) => {
		const filterGroup = page.getByRole('group', { name: /Filter by time window/i });
		await expect(filterGroup).toBeVisible();
	});

	test('time filter has all expected options', async ({ page }) => {
		await expect(page.getByRole('button', { name: 'All time' })).toBeVisible();
		await expect(page.getByRole('button', { name: '1 year' })).toBeVisible();
		await expect(page.getByRole('button', { name: '90 days' })).toBeVisible();
		await expect(page.getByRole('button', { name: '30 days' })).toBeVisible();
	});

	test('"All time" is selected by default (aria-pressed)', async ({ page }) => {
		await expect(page.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');
	});

	test('clicking a time filter updates aria-pressed state', async ({ page }) => {
		await page.getByRole('button', { name: '30 days' }).click();
		await expect(page.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'false');
	});

	test('summary section has stat cards', async ({ page }) => {
		await expect(page.getByText(/Total reported/i)).toBeVisible();
		await expect(page.getByText(/Currently open/i)).toBeVisible();
		await expect(page.getByText(/Fill rate/i)).toBeVisible();
		await expect(page.getByText(/Avg days to fill/i)).toBeVisible();
	});

	test('monthly activity chart is present', async ({ page }) => {
		// The chart has role="img" with an aria-label
		await expect(
			page.getByRole('img', { name: /Bar chart of monthly pothole reports/i })
		).toBeVisible();
	});

	test('monthly activity chart has a screen-reader accessible table (WCAG 1.1.1)', async ({ page }) => {
		// The sr-only table is the accessible equivalent of the visual bar chart.
		// It must be in the DOM (visually hidden, not display:none) so screen readers can reach it.
		const table = page.locator('table').filter({ has: page.locator('caption') });
		await expect(table).toBeAttached();
		await expect(table.locator('th', { hasText: 'Month' })).toBeAttached();
		await expect(table.locator('th', { hasText: 'Reported' })).toBeAttached();
		await expect(table.locator('th', { hasText: 'Filled' })).toBeAttached();
		// 18 months are always rendered (even with no data)
		await expect(table.locator('tbody tr')).toHaveCount(18);
	});

	test('ward leaderboard section is present', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /By ward/i })).toBeVisible();
	});

	test('worst offenders section is present', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /Longest-open/i })).toBeVisible();
	});

	test('page title includes Stats', async ({ page }) => {
		await expect(page).toHaveTitle(/Stats — fillthehole\.ca/i);
	});

	test('ward section resolves from loading into table or empty state', async ({ page }) => {
		// The ward section passes through wardLoading=true ("Assigning wards…")
		// before settling. Wait for the spinner to disappear, then check that
		// either the grade-column table or the empty-state message is present.
		// Both are valid outcomes — no live DB means empty state.
		await page.locator('[aria-busy="true"]').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
			// aria-busy element may already be gone if GeoJSON loaded quickly
		});
		const hasTable = (await page.locator('th[title*="Accountability grade"]').count()) > 0;
		const hasEmptyState = (await page.getByText(/No ward data available/i).count()) > 0;
		expect(hasTable || hasEmptyState).toBe(true);
	});

	test('ward table grade cells contain valid grade values (A–F or —)', async ({ page }) => {
		// Grade cells carry a title attribute set by the wardGrade() function.
		// Conditional: skipped when there are no ward rows (no live DB connection).
		const gradeCells = page.locator('td[title^="Grade:"]');
		const count = await gradeCells.count();
		for (let i = 0; i < count; i++) {
			const text = (await gradeCells.nth(i).innerText()).trim();
			expect(text).toMatch(/^[A-F—]$/);
		}
	});
});
