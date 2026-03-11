import { test, expect } from "@playwright/test";

test.describe("Homepage intro first-visit behaviour", () => {
  test("intro card is visible on first home visit", async ({ page }) => {
    await page.goto("/");

    const intro = page.getByRole("region", {
      name: /report a pothole in about 30 seconds/i,
    });
    await expect(intro).toBeVisible();
    await expect(
      intro.getByRole("link", { name: /report a pothole/i }),
    ).toBeVisible();
    await expect(
      intro.getByRole("link", { name: /learn how it works/i }),
    ).toBeVisible();
  });

  test("intro stays non-blocking and page landmarks remain accessible", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute(
      "href",
      "#maincontent",
    );
  });

  test("dismiss button hides intro and sets localStorage key", async ({
    page,
  }) => {
    await page.goto("/");

    const intro = page.getByRole("region", {
      name: /report a pothole in about 30 seconds/i,
    });
    await expect(intro).toBeVisible();

    await page.getByRole("button", { name: /dismiss introduction/i }).click();
    await expect(intro).toBeHidden();

    const dismissed = await page.evaluate(() =>
      localStorage.getItem("fth-home-intro-dismissed"),
    );
    expect(dismissed).toBe("1");
  });

  test("primary CTA dismisses intro and navigates to report", async ({
    page,
  }) => {
    await page.goto("/");

    const intro = page.getByRole("region", {
      name: /report a pothole in about 30 seconds/i,
    });

    await intro.getByRole("link", { name: /report a pothole/i }).click();
    await expect(page).toHaveURL(/\/report$/);

    const dismissed = await page.evaluate(() =>
      localStorage.getItem("fth-home-intro-dismissed"),
    );
    expect(dismissed).toBe("1");
  });

  test("returning home visitor does not see intro again", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fth-home-intro-dismissed", "1");
    });

    await page.goto("/");

    const intro = page.getByRole("region", {
      name: /report a pothole in about 30 seconds/i,
    });
    await expect(intro).toBeHidden();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("intro is only shown on the homepage", async ({ page }) => {
    await page.goto("/about");
    await expect(
      page.getByRole("region", {
        name: /report a pothole in about 30 seconds/i,
      }),
    ).toBeHidden();
  });

  test("intro content is accessible and properly labelled", async ({
    page,
  }) => {
    await page.goto("/");

    const intro = page.getByRole("region", {
      name: /report a pothole in about 30 seconds/i,
    });
    await expect(intro).toBeVisible();

    const title = page.locator("#welcome-title");
    await expect(title).toBeVisible();
    await expect(intro).toHaveAttribute("aria-labelledby", "welcome-title");
  });

  test("intro handles localStorage errors gracefully", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.getItem = () => {
        throw new Error("localStorage disabled");
      };
      localStorage.setItem = () => {
        throw new Error("localStorage disabled");
      };
    });

    await page.goto("/");

    const intro = page.getByRole("region", {
      name: /report a pothole in about 30 seconds/i,
    });
    await expect(intro).toBeVisible();

    await page.getByRole("button", { name: /dismiss introduction/i }).click();
    await expect(intro).toBeHidden();
  });

  test("intro content includes expected onboarding information", async ({
    page,
  }) => {
    await page.goto("/");

    const intro = page.getByRole("region", {
      name: /report a pothole in about 30 seconds/i,
    });
    await expect(intro).toBeVisible();
    await expect(
      intro.getByText(/independent community tracker/i),
    ).toBeVisible();
    await expect(
      intro.getByText(/community-run and open source/i),
    ).toBeVisible();
  });
});
