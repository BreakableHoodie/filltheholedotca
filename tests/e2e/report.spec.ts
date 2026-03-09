import { expect, test } from '@playwright/test';

test.describe('Report page readiness summary', () => {
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

	test('prompts for a location before submit is enabled', async ({ page }) => {
		await page.goto('/report');

		await expect(page.getByText('Ready to submit')).toBeVisible();
		await expect(page.getByText('Choose a location above to unlock the report button.')).toBeVisible();
		await expect(page.getByRole('button', { name: /Submit report/i })).toBeDisabled();
	});

	test('shows a locked-in summary when a map location is preselected', async ({ page }) => {
		await page.goto('/report?lat=43.425&lng=-80.42');

		await expect(page.getByText('Location locked in')).toBeVisible();
		await expect(page.getByText('Optional — not added yet')).toHaveCount(2);
		await expect(page.getByText(/After you submit, a pothole page is created right away./i)).toBeVisible();
		await expect(page.getByRole('button', { name: /Submit report/i })).toBeEnabled();
	});
});
