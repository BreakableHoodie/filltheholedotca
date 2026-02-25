import { test, expect } from '@playwright/test';

test.describe('Map page smoke test', () => {
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

	test('map container renders with non-zero dimensions', async ({ page }) => {
		await page.goto('/');

		// Wait for the page to load
		await expect(page.getByRole('main')).toBeVisible();

		// Look for the Leaflet map container
		// Leaflet typically creates a div with class 'leaflet-container'
		const mapContainer = page.locator('.leaflet-container').first();
		
		// Wait for the map to be initialized (Leaflet is loaded dynamically in onMount)
		await expect(mapContainer).toBeVisible({ timeout: 10000 });

		// Check that the map container has non-zero dimensions
		const boundingBox = await mapContainer.boundingBox();
		expect(boundingBox).not.toBeNull();
		expect(boundingBox!.width).toBeGreaterThan(0);
		expect(boundingBox!.height).toBeGreaterThan(0);

		// The map should take up a reasonable amount of space
		expect(boundingBox!.width).toBeGreaterThan(300);
		expect(boundingBox!.height).toBeGreaterThan(200);
	});

	test('"Find me" button is present in the UI', async ({ page }) => {
		await page.goto('/');

		// The locate button is labelled "Find me" (see +page.svelte)
		const locateButton = page.getByRole('button', { name: /Find me/i });
		
		await expect(locateButton).toBeVisible({ timeout: 10000 });

		// Verify the button is interactive  
		await expect(locateButton).toBeEnabled();
	});

	test('map loads without JavaScript console errors', async ({ page }) => {
		const consoleErrors: string[] = [];
		
		// Capture console errors
		page.on('console', msg => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text());
			}
		});

		// Capture page errors  
		page.on('pageerror', err => {
			consoleErrors.push(`Page error: ${err.message}`);
		});

		await page.goto('/');

		// Wait for map to load
		await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 10000 });

		// Wait for tile requests and async map operations to settle
		await page.waitForLoadState('networkidle');

		// Filter out non-critical errors (e.g., network errors for tiles in test env)
		const criticalErrors = consoleErrors.filter(error => 
			!error.includes('tile') && 
			!error.includes('404') &&
			!error.includes('openstreetmap') &&
			!error.toLowerCase().includes('network error')
		);

		if (criticalErrors.length > 0) {
			console.log('JavaScript errors found:', criticalErrors);
		}

		// No critical JavaScript errors should occur during map loading
		expect(criticalErrors).toHaveLength(0);
	});

	test('map control buttons are accessible', async ({ page }) => {
		await page.goto('/');

		// Wait for map to load
		await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 10000 });

		// Check for basic Leaflet controls (zoom in/out)  
		const zoomIn = page.locator('.leaflet-control-zoom-in');
		const zoomOut = page.locator('.leaflet-control-zoom-out');

		await expect(zoomIn).toBeVisible();
		await expect(zoomOut).toBeVisible();

		// Controls should be keyboard accessible
		await zoomIn.focus();
		await expect(zoomIn).toBeFocused();
		
		await zoomOut.focus();
		await expect(zoomOut).toBeFocused();
	});

	test('map container has proper ARIA attributes', async ({ page }) => {
		await page.goto('/');

		// Wait for map to load
		const mapContainer = page.locator('.leaflet-container').first();
		await expect(mapContainer).toBeVisible({ timeout: 10000 });

		// Leaflet should set up the map container appropriately
		// Check that it has a reasonable role or is at least not breaking accessibility
		const containerAttributes = await mapContainer.evaluate(el => ({
			tabindex: el.getAttribute('tabindex'),
			role: el.getAttribute('role'),
			ariaLabel: el.getAttribute('aria-label')
		}));

		// Leaflet typically makes the map focusable
		expect(containerAttributes.tabindex).not.toBeNull();
	});

	test('page title and meta information is correct', async ({ page }) => {
		await page.goto('/');

		// Check page title
		await expect(page).toHaveTitle(/FillTheHole\.ca/i);

		// The page should have proper meta tags for a map application
		const viewport = page.locator('meta[name="viewport"]');
		await expect(viewport).toHaveAttribute('content', /width=device-width/);
	});

	test('navigation menu is accessible from map page', async ({ page }) => {
		await page.goto('/');

		// Navigation should be present and accessible
		const nav = page.getByRole('navigation');
		await expect(nav).toBeVisible();

		// Check that key navigation links are present
		await expect(page.getByRole('link', { name: /report/i }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: /stats/i })).toBeVisible(); 
		await expect(page.getByRole('link', { name: /about/i })).toBeVisible();
	});

	test.describe('Map layer panel', () => {
		test('shows a Layers panel', async ({ page }) => {
			await page.goto('/');
			await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });
			await expect(page.getByText(/Layers/i)).toBeVisible();
		});

		test('Reported layer is on by default', async ({ page }) => {
			await page.goto('/');
			await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });
			const toggle = page.getByRole('checkbox', { name: /Reported/i });
			await expect(toggle).toBeChecked();
		});

		test('Expired and Filled layers are off by default', async ({ page }) => {
			await page.goto('/');
			await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });
			await expect(page.getByRole('checkbox', { name: /Expired/i })).not.toBeChecked();
			await expect(page.getByRole('checkbox', { name: /Filled/i })).not.toBeChecked();
		});

		test('Ward heatmap toggle is in the layers panel', async ({ page }) => {
			await page.goto('/');
			await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });
			await expect(page.getByRole('checkbox', { name: /Ward heatmap/i })).toBeVisible();
		});
	});

	test('map page responds to keyboard navigation', async ({ page }) => {
		await page.goto('/');

		const mapContainer = page.locator('.leaflet-container').first();
		await expect(mapContainer).toBeVisible({ timeout: 10000 });

		// Focus the map container

		await mapContainer.focus();
		await expect(mapContainer).toBeFocused();

		// Test that arrow keys don't cause JavaScript errors
		// (We're not testing full Leaflet keyboard functionality, just that it doesn't break)
		await page.keyboard.press('ArrowUp');
		await page.keyboard.press('ArrowDown'); 
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowRight');

		// Plus/minus keys for zoom  
		await page.keyboard.press('Equal'); // + key
		await page.keyboard.press('Minus'); // - key

		// Map should still be visible and functional after keyboard interaction
		await expect(mapContainer).toBeVisible();
	});
});

test.describe('Main map — report here mode', () => {
	test.use({
		storageState: {
			cookies: [],
			origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: 'fth-welcomed', value: '1' }] }]
		}
	});

	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });
	});

	test('shows Report here button', async ({ page }) => {
		await expect(page.getByRole('button', { name: /Report here/i })).toBeVisible();
	});

	test('clicking Report here shows cancel banner', async ({ page }) => {
		await page.getByRole('button', { name: /Report here/i }).click();
		await expect(page.getByText(/Tap the map where the pothole is/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
	});

	test('cancel exits report mode', async ({ page }) => {
		await page.getByRole('button', { name: /Report here/i }).click();
		await page.getByRole('button', { name: /Cancel/i }).click();
		await expect(page.getByText(/Tap the map where the pothole is/i)).toBeHidden();
	});

	test('map click enables confirm and navigates to prefilled report URL', async ({ page }) => {
		await page.getByRole('button', { name: /Report here/i }).click();
		await expect(page.getByText(/Tap the map where the pothole is/i)).toBeVisible();

		await page.locator('.leaflet-container').click({ position: { x: 260, y: 220 } });

		const confirm = page.getByRole('button', { name: /Confirm location/i });
		await expect(confirm).toBeVisible();
		await confirm.click();

		await expect(page).toHaveURL(/\/report\?lat=-?\d+(\.\d+)?&lng=-?\d+(\.\d+)?/, { timeout: 10000 });
	});
});
