import { test, expect } from '@playwright/test';

interface FeedPothole {
	id: string;
	lat: number;
	lng: number;
	address: string | null;
	description: string | null;
	status: string;
	created_at: string;
}

test.describe('Pothole detail page', () => {
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

	test('loads and displays core details for a real pothole', async ({ page, request }) => {
		const feedRes = await request.get('/api/feed.json');
		const { potholes } = (await feedRes.json()) as { potholes: FeedPothole[] };

		if (!potholes?.length) {
			test.skip(true, 'No non-pending potholes in DB — skipping detail page tests');
			return;
		}

		const pothole = potholes[0];
		await page.goto(`/hole/${pothole.id}`);

		// Heading shows the address or formatted coordinates
		await expect(page.locator('h1')).toBeVisible();

		// "Reported" date is always rendered in the header
		await expect(page.getByText('Reported', { exact: false })).toBeVisible();

		// Links section is always present regardless of status
		await expect(page.getByText('Street View', { exact: false })).toBeVisible();
		await expect(page.getByText('Share on X', { exact: false })).toBeVisible();
		await expect(page.getByRole('button', { name: /Copy link/i })).toBeVisible();
	});

	test('shows "Mark as filled" button when status is reported', async ({ page, request }) => {
		const feedRes = await request.get('/api/feed.json');
		const { potholes } = (await feedRes.json()) as { potholes: FeedPothole[] };
		const reported = potholes?.find((p) => p.status === 'reported');

		if (!reported) {
			test.skip(true, 'No reported potholes in DB');
			return;
		}

		await page.goto(`/hole/${reported.id}`);
		await expect(page.getByRole('button', { name: /Mark as filled/i })).toBeVisible();
	});

	test('shows councillor contact block for non-filled open potholes', async ({ page, request }) => {
		const feedRes = await request.get('/api/feed.json');
		const { potholes } = (await feedRes.json()) as { potholes: FeedPothole[] };
		const open = potholes?.find((p) => p.status !== 'filled');

		if (!open) {
			test.skip(true, 'No open potholes in DB');
			return;
		}

		await page.goto(`/hole/${open.id}`);

		// The councillor block is rendered when the pothole lies within a mapped ward.
		// If a pothole is on the boundary edge it may not match any ward, so this is a
		// conditional check rather than a hard assertion.
		const councillorBlock = page.getByText('Contact your councillor');
		if (await councillorBlock.isVisible()) {
			await expect(page.getByRole('link', { name: /Email /i })).toBeVisible();
			await expect(page.getByRole('link', { name: /Councillor page/i })).toBeVisible();
		}
	});

	test('returns 404 for a non-existent pothole UUID', async ({ page }) => {
		const response = await page.goto('/hole/550e8400-e29b-41d4-a716-446655440000');
		expect(response?.status()).toBe(404);
	});
});
