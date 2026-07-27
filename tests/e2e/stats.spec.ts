import { test, expect } from '@playwright/test';

test.describe('Stats page', () => {
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
		await expect(page.getByRole('button', { name: 'All time' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
	});

	test('clicking a time filter updates aria-pressed state', async ({ page }) => {
		await page.getByRole('button', { name: '30 days' }).click();
		await expect(page.getByRole('button', { name: '30 days' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await expect(page.getByRole('button', { name: 'All time' })).toHaveAttribute(
			'aria-pressed',
			'false',
		);
	});

	test('summary section has stat cards', async ({ page }) => {
		await expect(page.getByText(/Total reported/i)).toBeVisible();
		await expect(page.getByText(/Currently open/i)).toBeVisible();
		await expect(page.getByText(/Fill rate/i)).toBeVisible();
		await expect(page.getByText(/Avg days to fill/i)).toBeVisible();
	});

	test('monthly activity chart is present', async ({ page }) => {
		// The chart has role="img" with an aria-label. Match the stable phrase in
		// the label so adding the freeze–thaw line to the description doesn't break it.
		await expect(
			page.getByRole('img', { name: /monthly pothole reports and fills/i }),
		).toBeVisible();
	});

	test('monthly activity chart has a screen-reader accessible table (WCAG 1.1.1)', async ({
		page,
	}) => {
		// The sr-only table is the accessible equivalent of the visual bar chart.
		// It must be in the DOM (visually hidden, not display:none) so screen readers can reach it.
		const table = page.getByRole('table', { name: /Monthly pothole reports/i });
		await expect(table).toBeAttached();
		await expect(table.getByRole('columnheader', { name: 'Month' })).toBeAttached();
		await expect(table.getByRole('columnheader', { name: 'Reported' })).toBeAttached();
		await expect(table.getByRole('columnheader', { name: 'Filled' })).toBeAttached();
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

	test('ward section shows the "No ward data" empty state without the fixture query param', async ({
		page,
	}) => {
		// beforeEach navigates to bare /stats. Without ?__fixture=1 the load
		// function always returns potholes: [] (see
		// src/routes/stats/+page.server.ts), so wardRows is always empty and the
		// only reachable branch is the "No ward data" empty state — never the
		// table, and (since filtered.length is 0) never the "ward lookup
		// failed" banner either. The stats page has no client-side ward loading
		// state to wait for — ward assignment happens server-side in the load
		// function — so the SSR'd HTML already reflects this by the time
		// beforeEach's goto() resolves.
		await expect(
			page.getByText('No ward data available for the selected window.'),
		).toBeVisible();
		await expect(page.locator('th[title*="Accountability grade"]')).toHaveCount(0);
	});

	test('ward table shows the accountability grade for the fixture ward', async ({ page }) => {
		// Override beforeEach's bare /stats navigation: only ?__fixture=1 makes
		// the loader return E2E_STATS_FIXTURE (see
		// src/routes/stats/+page.server.ts) — a single "reported" pothole in
		// ward kitchener-6 — so this is the only way the ward table ever
		// renders a real row in this test environment.
		await page.goto('/stats?__fixture=1');

		const gradeCells = page.locator('td[title^="Grade:"]');
		await expect(gradeCells).toHaveCount(1);
		// Only 1 report for this ward — below wardGrade()'s 5-report minimum
		// sample size, so the deterministic output is the placeholder dash,
		// not a computed letter grade.
		await expect(gradeCells).toHaveText('—');
	});
});
