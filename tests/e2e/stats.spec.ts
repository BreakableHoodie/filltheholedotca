import { test, expect } from '@playwright/test';

test.describe('Stats page', () => {
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

	test('ward leaderboard section is present', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /By ward/i })).toBeVisible();
	});

	test('worst offenders section is present', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /Longest-open/i })).toBeVisible();
	});

	test('page title includes Stats', async ({ page }) => {
		await expect(page).toHaveTitle(/Stats — fillthehole\.ca/i);
	});
});
