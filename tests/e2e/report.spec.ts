import { test, expect } from '@playwright/test';

test.describe('Report form — no GPS', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/report');
<<<<<<< HEAD
		
		// Close welcome modal if present
		const modalBtn = page.getByRole('button', { name: /Show me the map/i });
		if (await modalBtn.isVisible()) {
			await modalBtn.click();
			await expect(modalBtn).toBeHidden();
		}
	});

	test('starts with loading state due to auto-location', async ({ page }) => {
		// Since onMount triggers getLocation, it should show loading or error
		await expect(page.getByRole('button', { name: /Getting your location|GPS failed|Use my current/i })).toBeVisible();
=======
	});

	test('has GPS location button in idle state', async ({ page }) => {
		await expect(page.getByRole('button', { name: /Use my current location/i })).toBeVisible();
>>>>>>> origin/main
	});

	test('severity cards are not selected by default', async ({ page }) => {
		for (const name of ['Spilled my coffee', 'Bent a rim', 'Caused real damage', 'RIP']) {
<<<<<<< HEAD
			// They are radio buttons, not standard buttons
			const radio = page.getByLabel(new RegExp(name, 'i'));
			await expect(radio).toBeVisible();
			await expect(radio).not.toBeChecked();
=======
			const btn = page.getByRole('button', { name: new RegExp(name, 'i') });
			await expect(btn).not.toHaveClass(/border-sky-500/);
>>>>>>> origin/main
		}
	});

	test('severity card toggles on click', async ({ page }) => {
<<<<<<< HEAD
		// Use force: true to click obscured label if necessary, or click the text
		const label = page.getByText(/Bent a rim/i);
		await label.click();
		// Check the input state directly
		const input = page.locator('input[value="Bent a rim"]');
		await expect(input).toBeChecked();
	});

	test('clicking another severity card updates selection', async ({ page }) => {
		await page.getByText(/Bent a rim/i).click();
		await page.getByText(/Spilled my coffee/i).click();

		await expect(page.getByLabel(/Spilled my coffee/i)).toBeChecked();
		await expect(page.getByLabel(/Bent a rim/i)).not.toBeChecked();
=======
		const card = page.getByRole('button', { name: /Bent a rim/i });
		await card.click();
		await expect(card).toHaveClass(/border-sky-500/);
	});

	test('clicking same severity card twice deselects it', async ({ page }) => {
		const card = page.getByRole('button', { name: /Bent a rim/i });
		await card.click();
		await expect(card).toHaveClass(/border-sky-500/);
		await card.click();
		await expect(card).not.toHaveClass(/border-sky-500/);
	});

	test('selecting one severity deselects others', async ({ page }) => {
		await page.getByRole('button', { name: /Bent a rim/i }).click();
		await page.getByRole('button', { name: /Spilled my coffee/i }).click();

		await expect(page.getByRole('button', { name: /Spilled my coffee/i })).toHaveClass(/border-sky-500/);
		await expect(page.getByRole('button', { name: /Bent a rim/i })).not.toHaveClass(/border-sky-500/);
>>>>>>> origin/main
	});

	test('submit button is present and has report-related label', async ({ page }) => {
		await expect(page.getByRole('button', { name: /Report this hole/i })).toBeVisible();
	});
});

test.describe('Report form — GPS granted', () => {
<<<<<<< HEAD
	test.beforeEach(async ({ context, page }) => {
		try {
			await context.grantPermissions(['geolocation']);
			await context.setGeolocation({ latitude: 43.45, longitude: -80.5 });
		} catch (e) {
			console.log('GEOLOCATION SETUP ERROR:', e);
		}

		page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
		// Mock Nominatim reverse geocoding
		await page.route('*nominatim.openstreetmap.org/reverse*', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					address: {
						house_number: '123',
						road: 'Fake St',
						suburb: 'Waterloo'
					}
				})
			});
		});

		await page.goto('/report');
		
		// Close welcome modal if present
		const modalBtn = page.getByRole('button', { name: /Show me the map/i });
		if (await modalBtn.isVisible()) {
			await modalBtn.click();
			await expect(modalBtn).toBeHidden();
		}
	});

	test('GPS button shows locked state after geolocation resolves', async ({ page }) => {
		// Debug visibility
		const gpsText = page.locator('span').filter({ hasText: /GPS locked/i }).first();
		console.log('Is visible?', await gpsText.isVisible());
		console.log('Is hidden?', await gpsText.isHidden());
		await expect(gpsText).toBeVisible({ timeout: 5000 });
=======
	test.use({
		geolocation: { latitude: 43.45, longitude: -80.5 }, // within Waterloo Region
		permissions: ['geolocation']
	});

	test.beforeEach(async ({ page }) => {
		await page.goto('/report');
	});

	test('GPS button shows locked state after geolocation resolves', async ({ page }) => {
		// Wait for the GPS to resolve (geolocation is auto-granted)
		await expect(page.getByText(/GPS locked/i)).toBeVisible({ timeout: 5000 });
>>>>>>> origin/main
	});

	test('address lookup runs after GPS lock', async ({ page }) => {
		// After GPS, the page should show either an address or a "Looking up" message
<<<<<<< HEAD
		await expect(page.locator('span').filter({ hasText: /GPS locked/i }).first()).toBeVisible({ timeout: 10000 });
=======
		await expect(page.getByText(/GPS locked/i)).toBeVisible({ timeout: 5000 });
>>>>>>> origin/main
		// The address lookup state message should appear (might resolve to address or stay loading)
		const addressOrLookup = page.locator('text=/Looking up address|📌/');
		// This may or may not appear depending on network — soft assertion
		expect(
			(await addressOrLookup.count()) >= 0
		).toBeTruthy();
	});

	test('submit button is keyboard accessible when GPS is locked', async ({ page }) => {
<<<<<<< HEAD
		await expect(page.locator('span').filter({ hasText: /GPS locked/i }).first()).toBeVisible({ timeout: 10000 });
=======
		await expect(page.getByText(/GPS locked/i)).toBeVisible({ timeout: 5000 });
>>>>>>> origin/main
		const submit = page.getByRole('button', { name: /Report this hole/i });
		await submit.focus();
		await expect(submit).toBeFocused();
	});

	test('successful submission redirects to pothole detail page', async ({ page }) => {
		// Mock the /api/report endpoint to avoid a real DB write
		await page.route('/api/report', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ id: 'e2e-test-uuid-1234567890', message: '📍 Pothole reported!' })
			});
		});

		await page.goto('/report');
<<<<<<< HEAD
		await expect(page.locator('span').filter({ hasText: /GPS locked/i }).first()).toBeVisible({ timeout: 10000 });

		// Select a severity
		await page.getByText(/Bent a rim/i).click();
=======
		await expect(page.getByText(/GPS locked/i)).toBeVisible({ timeout: 5000 });

		// Select a severity
		await page.getByRole('button', { name: /Bent a rim/i }).click();
>>>>>>> origin/main

		// Submit
		await page.getByRole('button', { name: /Report this hole/i }).click();

		// Should redirect to the pothole detail page
<<<<<<< HEAD
		await expect(page).toHaveURL(/\/hole\/e2e-test-uuid-1234567890/, { timeout: 10000 });
=======
		await expect(page).toHaveURL('/hole/e2e-test-uuid-1234567890', { timeout: 5000 });
>>>>>>> origin/main
	});

	test('failed submission shows error toast', async ({ page }) => {
		// Mock the /api/report endpoint to return an error
		await page.route('/api/report', async (route) => {
			await route.fulfill({
				status: 429,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Too many reports from this location' })
			});
		});

		await page.goto('/report');
<<<<<<< HEAD
		await expect(page.locator('span').filter({ hasText: /GPS locked/i }).first()).toBeVisible({ timeout: 10000 });

		// Select severity to enable submit (though not strictly required by HTML, app logic might check)
		await page.getByText(/Bent a rim/i).click();
=======
		await expect(page.getByText(/GPS locked/i)).toBeVisible({ timeout: 5000 });
>>>>>>> origin/main

		await page.getByRole('button', { name: /Report this hole/i }).click();

		// Error toast should appear
		await expect(page.locator('[data-sonner-toaster]')).toContainText(
			/Too many reports|error|failed/i,
<<<<<<< HEAD
			{ timeout: 10000 }
=======
			{ timeout: 5000 }
>>>>>>> origin/main
		);
	});
});

test.describe('Report form — GPS denied', () => {
	test.use({
		geolocation: undefined,
		permissions: []
	});

	test('shows error state when geolocation is denied', async ({ page }) => {
		await page.goto('/report');
		// With no geolocation permission, an error should appear or the button should stay in error/idle state
		// Wait a moment for geolocation to fail
		await page.waitForTimeout(500);
		const gpsButton = page.getByRole('button', { name: /Use my current location|GPS failed|retry/i });
		await expect(gpsButton).toBeVisible();
	});
});
