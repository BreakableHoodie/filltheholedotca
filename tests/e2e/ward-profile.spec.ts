import { test, expect } from '@playwright/test';

function wardFixtureUrl(city: string, ward: number) {
  return `/stats/ward/${city}/${ward}?__fixture=1`;
}

test.describe('Ward profile page', () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [{
        origin: 'http://localhost:4173',
        localStorage: [{ name: 'fth-home-intro-dismissed', value: '1' }],
      }],
    },
  });

  test('shows councillor name and ward info', async ({ page }) => {
    await page.goto(wardFixtureUrl('kitchener', 9));
    await expect(page.getByRole('heading', { name: /Debbie Chapman/ })).toBeVisible();
    await expect(page.getByText(/Ward 9/)).toBeVisible();
    await expect(page.getByText(/Kitchener/)).toBeVisible();
  });

  test('shows stat pills', async ({ page }) => {
    await page.goto(wardFixtureUrl('kitchener', 9));
    // 2 total potholes in fixture: 1 reported, 1 filled
    // Use exact:true to avoid partial matches against chart axis labels (e.g. "Apr 25")
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
  });

  test('shows open potholes list', async ({ page }) => {
    await page.goto(wardFixtureUrl('kitchener', 9));
    await expect(page.getByText('Weber St E')).toBeVisible();
  });

  test('shows email councillor link', async ({ page }) => {
    await page.goto(wardFixtureUrl('kitchener', 9));
    const emailLink = page.getByRole('link', { name: /Email Debbie/ });
    await expect(emailLink).toBeVisible();
    const href = await emailLink.getAttribute('href');
    expect(href).toMatch(/^mailto:/);
    expect(href).toContain('Debbie.Chapman@kitchener.ca');
  });

  test('returns 404 for invalid city', async ({ page }) => {
    const response = await page.goto('/stats/ward/invalidcity/1');
    expect(response?.status()).toBe(404);
  });

  test('returns 404 for invalid ward number', async ({ page }) => {
    const response = await page.goto('/stats/ward/kitchener/999');
    expect(response?.status()).toBe(404);
  });

  test('OG image endpoint returns PNG', async ({ request }) => {
    const response = await request.get('/api/og/ward/kitchener/9');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
  });

  test('stats page ward rows link to ward profile pages', async ({ page }) => {
    // Mock the ward geojson so this test never hits external ArcGIS services in CI.
    await page.route('**/api/wards.geojson', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [-80.55, 43.45], [-80.50, 43.45],
                [-80.50, 43.40], [-80.55, 43.40], [-80.55, 43.45]
              ]]
            },
            properties: { CITY: 'kitchener', WARDID_NORM: 9 }
          }]
        })
      })
    );
    await page.goto('/stats?__fixture=1');
    await page.waitForSelector('a[href*="/stats/ward/"]', { timeout: 10000 });
    const link = page.locator('a[href*="/stats/ward/"]').first();
    await expect(link).toBeVisible();
  });
});
