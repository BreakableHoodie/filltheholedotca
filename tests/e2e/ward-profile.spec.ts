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
    await expect(page.getByText('2')).toBeVisible(); // total reported
    await expect(page.getByText('1')).toBeVisible(); // filled
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
    await page.goto('/stats');
    // Ward table is loaded client-side after geojson fetch — wait for it
    await page.waitForSelector('a[href*="/stats/ward/"]', { timeout: 10000 });
    const link = page.locator('a[href*="/stats/ward/"]').first();
    await expect(link).toBeVisible();
  });
});
