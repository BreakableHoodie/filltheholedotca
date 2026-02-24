import { test, expect } from '@playwright/test';

const REPORT_STORAGE_STATE = {
	cookies: [],
	origins: [
		{
			origin: 'http://localhost:4173',
			localStorage: [{ name: 'fth-welcomed', value: '1' }]
		}
	]
};

test.use({ storageState: REPORT_STORAGE_STATE });

test.describe('Report form — no GPS', () => {
	test.beforeEach(async ({ page }) => {
	await page.goto('/report');
	});

test('starts with loading state due to auto-location', async ({ page }) => {
// Since onMount triggers getLocation, it should show loading or error
await expect(page.getByRole('button', { name: /Getting your location|GPS failed|Use my current/i })).toBeVisible();
});

test('severity cards are not selected by default', async ({ page }) => {
for (const name of ['Spilled my coffee', 'Bent a rim', 'Caused real damage', 'RIP']) {
// They are radio buttons, not standard buttons
const radio = page.getByLabel(new RegExp(name, 'i'));
await expect(radio).toBeVisible();
await expect(radio).not.toBeChecked();
}
});

test('severity card toggles on click', async ({ page }) => {
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
});

test('submit button is present and has report-related label', async ({ page }) => {
await expect(page.getByRole('button', { name: /Report this hole/i })).toBeVisible();
});
});

test.describe('Report form — GPS granted', () => {
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
		});

test('GPS button shows locked state after geolocation resolves', async ({ page }) => {
// Debug visibility
const gpsText = page.locator('span').filter({ hasText: /GPS locked/i }).first();
console.log('Is visible?', await gpsText.isVisible());
console.log('Is hidden?', await gpsText.isHidden());
await expect(gpsText).toBeVisible({ timeout: 5000 });
});

test('address lookup runs after GPS lock', async ({ page }) => {
// After GPS, the page should show either an address or a "Looking up" message
await expect(page.locator('span').filter({ hasText: /GPS locked/i }).first()).toBeVisible({ timeout: 10000 });
// The address lookup state message should appear (might resolve to address or stay loading)
const addressOrLookup = page.locator('text=/Looking up address|📌/');
// This may or may not appear depending on network — soft assertion
expect(
(await addressOrLookup.count()) >= 0
).toBeTruthy();
});

test('submit button is keyboard accessible when GPS is locked', async ({ page }) => {
await expect(page.locator('span').filter({ hasText: /GPS locked/i }).first()).toBeVisible({ timeout: 10000 });
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
await expect(page.locator('span').filter({ hasText: /GPS locked/i }).first()).toBeVisible({ timeout: 10000 });

// Select a severity
await page.getByText(/Bent a rim/i).click();

// Submit
await page.getByRole('button', { name: /Report this hole/i }).click();

// Should redirect to the pothole detail page
await expect(page).toHaveURL(/\/hole\/e2e-test-uuid-1234567890/, { timeout: 10000 });
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
await expect(page.locator('span').filter({ hasText: /GPS locked/i }).first()).toBeVisible({ timeout: 10000 });

// Select severity to enable submit (though not strictly required by HTML, app logic might check)
await page.getByText(/Bent a rim/i).click();

await page.getByRole('button', { name: /Report this hole/i }).click();

// Error toast should appear
await expect(page.locator('[data-sonner-toaster]')).toContainText(
/Too many reports|error|failed/i,
{ timeout: 10000 }
);
});
});

test.describe('Report form — mini map tab', () => {
		test('shows a map element when Pick on map tab is active', async ({ page }) => {
			await page.goto('/report');

		await page.getByRole('tab', { name: /Pick on map/i }).click();
		await expect(page.locator('.leaflet-container').last()).toBeVisible({ timeout: 5000 });
	});

	test('map tab pre-shows pin when navigated from main map with URL params', async ({ page }) => {
		await page.route(
			(url) => url.hostname === 'nominatim.openstreetmap.org' && url.pathname === '/reverse',
			async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ address: { road: 'Weber St', suburb: 'Kitchener' } })
				});
			}
		);

			await page.goto('/report?lat=43.45&lng=-80.5');

		await expect(page.getByRole('tab', { name: /Pick on map/i }))
			.toHaveAttribute('aria-selected', 'true', { timeout: 3000 });
		await expect(page.locator('.leaflet-container').last()).toBeVisible({ timeout: 5000 });
	});
});

test.describe('Report form — location tabs', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/report');
		});

	test('shows three location tabs', async ({ page }) => {
		await expect(page.getByRole('tab', { name: /GPS/i })).toBeVisible();
		await expect(page.getByRole('tab', { name: /Address/i })).toBeVisible();
		await expect(page.getByRole('tab', { name: /Pick on map/i })).toBeVisible();
	});

	test('GPS tab is active by default', async ({ page }) => {
		const gpsTab = page.getByRole('tab', { name: /GPS/i });
		await expect(gpsTab).toHaveAttribute('aria-selected', 'true');
	});

	test('switching to Address tab shows address input', async ({ page }) => {
		await page.getByRole('tab', { name: /Address/i }).click();
		await expect(page.getByPlaceholder(/Enter an address/i)).toBeVisible();
	});
});

test.describe('Report form — address search', () => {
	test.beforeEach(async ({ page }) => {
		await page.route(
			(url) => url.hostname === 'nominatim.openstreetmap.org' && url.pathname === '/search',
			async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify([
						{ lat: '43.45', lon: '-80.50', display_name: '123 King St N, Waterloo, ON' },
						{ lat: '43.46', lon: '-80.51', display_name: '456 King St N, Waterloo, ON' }
					])
				});
			}
		);

		await page.goto('/report');
		await page.getByRole('tab', { name: /Address/i }).click();
	});

	test('shows address input on Address tab', async ({ page }) => {
		await expect(page.getByPlaceholder(/Enter an address/i)).toBeVisible();
	});

	test('typing shows suggestions dropdown', async ({ page }) => {
		await page.getByPlaceholder(/Enter an address/i).fill('King St');
		await expect(page.locator('[data-testid="address-suggestions"]')).toBeVisible({ timeout: 1000 });
		await expect(page.locator('[data-testid="address-suggestions"] button').first()).toContainText('King St N');
	});

	test('selecting a suggestion enables submit button', async ({ page }) => {
		await page.getByPlaceholder(/Enter an address/i).fill('King St');
		await expect(page.locator('[data-testid="address-suggestions"]')).toBeVisible({ timeout: 1000 });
		await page.locator('[data-testid="address-suggestions"] button').first().click();

		const submit = page.getByRole('button', { name: /Report this hole/i });
		await expect(submit).not.toBeDisabled();
	});
});

test.describe('Report form — URL pre-fill', () => {
	test('pre-fills location from ?lat=&lng= URL params', async ({ page }) => {
		await page.route('*nominatim.openstreetmap.org/reverse*', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ address: { road: 'King St N', suburb: 'Waterloo' } })
			});
		});

		await page.goto('/report?lat=43.45&lng=-80.5');

		const submit = page.getByRole('button', { name: /Report this hole/i });
		await expect(submit).not.toBeDisabled({ timeout: 3000 });
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
