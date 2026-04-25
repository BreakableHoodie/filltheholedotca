import { expect, test } from '@playwright/test';

const STORAGE_STATE = {
	cookies: [] as never[],
	origins: [
		{
			origin: 'http://localhost:4173',
			localStorage: [{ name: 'fth-home-intro-dismissed', value: '1' }]
		}
	]
};

test.describe('Report page readiness summary', () => {
	test.use({ storageState: STORAGE_STATE });

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

test.describe('GPS denial auto-redirect', () => {
	test.use({ storageState: STORAGE_STATE });

	test('switches to address tab and focuses it when geolocation is denied', async ({ page }) => {
		// Stub getCurrentPosition to immediately invoke the error callback with PERMISSION_DENIED.
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'geolocation', {
				value: {
					getCurrentPosition: (
						_success: PositionCallback,
						error: PositionErrorCallback
					) => {
						error({ code: 1, message: 'Permission denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
					}
				},
				configurable: true
			});
		});

		await page.goto('/report');

		// Scope to the GPS panel to avoid ARIA name ambiguity from the icon SVG prefix.
		const gpsPanel = page.locator('#location-panel-gps');
		await expect(gpsPanel).toBeVisible();
		await gpsPanel.locator('button[type="button"]').click();

		// Address tab should become selected and its panel visible.
		const addressTab = page.getByRole('tab', { name: 'Address' });
		await expect(addressTab).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel', { name: 'Address' })).toBeVisible();
	});
});
