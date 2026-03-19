import { test, expect } from "@playwright/test";

const seededReportedPothole = {
  id: "11111111-1111-4111-8111-111111111111",
  address: "700 King Street West",
} as const;

const seededPendingPothole = {
  id: "22222222-2222-4222-8222-222222222222",
  address: "55 Erb Street East",
} as const;

// Fixture with nearbyFilled data — exercises the recurring-road-issue banner
const seededNearbyFilledPothole = {
  id: "33333333-3333-4333-8333-333333333333",
  address: "200 Queen Street North",
} as const;

function fixtureDetailUrl(id: string) {
  return `/hole/${id}?__fixture=1`;
}

test.describe("Pothole detail page", () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:4173",
          localStorage: [{ name: "fth-home-intro-dismissed", value: "1" }],
        },
      ],
    },
  });

  test("loads seeded detail content with share links and official reporting actions", async ({
    page,
  }) => {
    await page.goto(fixtureDetailUrl(seededReportedPothole.id));

    // Heading shows the address or formatted coordinates
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: seededReportedPothole.address,
      }),
    ).toBeVisible();

    // The reported date is rendered in the header for the seeded fixture.
    await expect(page.getByText(/Reported Mar 7, 2026/i)).toBeVisible();

    // Links section is always present regardless of status
    await expect(page.getByText("Street View", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Copy link/i }),
    ).toBeVisible();

    // Official-reporting panel should expose city, region, and provincial paths.
    await expect(page.getByText("Report it officially too")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /File with City of Kitchener/i }),
    ).toHaveAttribute(
      "href",
      "https://www.kitchener.ca/en/transportation-and-parking/report-a-road-concern.aspx",
    );
    await expect(
      page.getByRole("link", { name: /File with Region of Waterloo/i }),
    ).toHaveAttribute(
      "href",
      "https://www.regionofwaterloo.ca/en/living-here/roads-and-traffic.aspx",
    );
    await expect(
      page.getByRole("link", {
        name: /Report those to the Ontario Ministry of Transportation/i,
      }),
    ).toHaveAttribute(
      "href",
      "https://www.ontario.ca/page/report-problem-provincial-highway",
    );

    // Seeded councillor actions should remain available without external ward lookups.
    await expect(page.getByRole("link", { name: /Email /i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Councillor page/i }),
    ).toBeVisible();
  });

  test("shows mark-filled action for the seeded reported pothole", async ({
    page,
  }) => {
    await page.goto(fixtureDetailUrl(seededReportedPothole.id));
    await expect(
      page.getByRole("button", { name: /Mark as filled/i }),
    ).toBeVisible();
  });

  test("shows submitted progress state for the seeded pending pothole", async ({
    page,
  }) => {
    await page.goto(`${fixtureDetailUrl(seededPendingPothole.id)}&submitted=1`);

    await expect(
      page.getByRole("heading", { name: /Report received/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/waiting for independent confirmation/i),
    ).toBeVisible();
    await expect(page.getByText(/Progress: 1\/2 confirmations/i)).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: seededPendingPothole.address,
      }),
    ).toBeVisible();
  });

  test("returns 404 for a non-existent pothole UUID", async ({ page }) => {
    const response = await page.goto(
      "/hole/550e8400-e29b-41d4-a716-446655440000",
    );
    expect(response?.status()).toBe(404);
  });

  test("shows the 'I hit this' button with hit count for a reported pothole", async ({
    page,
  }) => {
    await page.goto(fixtureDetailUrl(seededReportedPothole.id));

    // Button aria-label is "Record that you hit this pothole" when not yet submitted
    await expect(
      page.getByRole("button", { name: /Record that you hit this pothole/i }),
    ).toBeVisible();
    // Seeded fixture has hitCount: 3 → "3 drivers hit this."
    await expect(page.getByText(/3 drivers hit this/i)).toBeVisible();
  });

  test("'I hit this' button is hidden for a pending pothole", async ({
    page,
  }) => {
    await page.goto(fixtureDetailUrl(seededPendingPothole.id));

    // Only reported potholes show the hit signal block
    await expect(
      page.getByRole("button", { name: /Record that you hit this pothole/i }),
    ).not.toBeVisible();
  });

  test("shows the recurring road issue notice when nearbyFilled is populated", async ({
    page,
  }) => {
    await page.goto(fixtureDetailUrl(seededNearbyFilledPothole.id));

    await expect(page.getByText(/Recurring road issue/i)).toBeVisible();
    await expect(
      page.getByText(/this location may need a permanent repair/i),
    ).toBeVisible();
    // The nearby address is shown
    await expect(page.getByText(/198 Queen Street North/i)).toBeVisible();
  });

  test("does not show the recurring road issue notice when nearbyFilled is empty", async ({
    page,
  }) => {
    await page.goto(fixtureDetailUrl(seededReportedPothole.id));

    await expect(page.getByText(/Recurring road issue/i)).not.toBeVisible();
  });
});
