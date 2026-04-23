import { test, expect } from "@playwright/test";

// Shared helper: fill the login form and submit.
async function submitLoginForm(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { name: "Sign in" }),
  ).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Helper: log in with fixture credentials and complete MFA, returning the CSRF
// token (readable from the non-HttpOnly admin_csrf cookie after redirect).
async function loginWithMfa(
  page: import("@playwright/test").Page,
  { rememberDevice = false } = {},
) {
  await submitLoginForm(page, "e2e-mfa@test.local", "e2e-password");
  await page.waitForURL(/\/admin\/login\/mfa/);

  if (rememberDevice) {
    await page.getByLabel(/remember/i).check();
  }

  // The MFA page auto-submits on 6 digits — filling triggers the $effect.
  await page.getByLabel("Authenticator code").fill("000000");
  await page.waitForURL(/\/admin\//);

  const csrfToken = await page.evaluate(() =>
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("admin_csrf="))
      ?.split("=")[1] ?? "",
  );
  return { csrfToken };
}

test.describe("Admin — MFA login flow", () => {
  test("login form redirects to MFA page on valid credentials", async ({
    page,
  }) => {
    await submitLoginForm(page, "e2e-mfa@test.local", "e2e-password");
    await expect(page).toHaveURL(/\/admin\/login\/mfa/);
    await expect(
      page.getByRole("heading", { name: "Two-factor authentication" }),
    ).toBeVisible();
  });

  test("wrong password shows an error and stays on login", async ({
    page,
  }) => {
    await submitLoginForm(page, "e2e-mfa@test.local", "wrong-password");
    await expect(
      page.getByText("Invalid email or password"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page).not.toHaveURL(/\/admin\/login\/mfa/);
  });

  test("wrong MFA code shows an error and stays on MFA page", async ({
    page,
  }) => {
    await submitLoginForm(page, "e2e-mfa@test.local", "e2e-password");
    await page.waitForURL(/\/admin\/login\/mfa/);

    // The $effect auto-submits on 6 digits — no explicit click needed.
    await page.getByLabel("Authenticator code").fill("999999");
    await expect(
      page.getByText("Invalid code. Please try again."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login\/mfa/);
  });

  test("correct MFA code redirects to admin area", async ({ page }) => {
    await loginWithMfa(page);
    await expect(page).toHaveURL(/\/admin\//);
  });

  test("MFA page renders TOTP and backup code modes", async ({ page }) => {
    await submitLoginForm(page, "e2e-mfa@test.local", "e2e-password");
    await page.waitForURL(/\/admin\/login\/mfa/);

    // TOTP mode (default)
    await expect(
      page.getByRole("heading", { name: "Two-factor authentication" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Authenticator code"),
    ).toBeVisible();

    // Switch to backup code mode
    await page.getByRole("button", { name: "Use a backup code instead" }).click();
    await expect(
      page.getByRole("heading", { name: "Enter backup code" }),
    ).toBeVisible();
    await expect(page.getByLabel("Backup code")).toBeVisible();

    // Switch back
    await page.getByRole("button", { name: "Use authenticator code instead" }).click();
    await expect(
      page.getByRole("heading", { name: "Two-factor authentication" }),
    ).toBeVisible();
  });

  test("'Remember this device' sets the trusted device cookie", async ({
    page,
  }) => {
    await loginWithMfa(page, { rememberDevice: true });

    const cookies = await page.context().cookies();
    const trustedCookie = cookies.find(
      (c) => c.name === "admin_trusted_device",
    );
    expect(trustedCookie).toBeDefined();
    expect(trustedCookie!.value).toBe("e2e-trusted-device-token");
    expect(trustedCookie!.httpOnly).toBe(true);
  });

  test("trusted device cookie bypasses MFA on second login", async ({
    page,
  }) => {
    // First login with "remember device"
    await loginWithMfa(page, { rememberDevice: true });

    // Capture the trusted-device token before clearing all session state.
    // admin_session is HttpOnly so it can't be cleared via JS — use the context API.
    const allCookies = await page.context().cookies();
    const trustedCookie = allCookies.find(
      (c) => c.name === "admin_trusted_device",
    );
    expect(trustedCookie).toBeDefined();

    // Clear every cookie (removes admin_session + admin_csrf), then restore
    // only the trusted-device token so the login load() won't redirect us.
    await page.context().clearCookies();
    if (trustedCookie) {
      await page.context().addCookies([trustedCookie]);
    }

    // Navigate to login — no session present, so the form should render
    await page.goto("/admin/login");

    // Log in — trusted device should bypass the MFA step entirely
    await page.getByLabel("Email").fill("e2e-mfa@test.local");
    await page.getByLabel("Password").fill("e2e-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Should land in admin without passing through /mfa
    await expect(page).toHaveURL(/\/admin\//);
    await expect(page).not.toHaveURL(/\/admin\/login\/mfa/);
  });

  test("back link on MFA page returns to login", async ({ page }) => {
    await submitLoginForm(page, "e2e-mfa@test.local", "e2e-password");
    await page.waitForURL(/\/admin\/login\/mfa/);
    await page.getByRole("link", { name: "Back to sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("admin CSRF token is set after MFA login", async ({ page }) => {
    const { csrfToken } = await loginWithMfa(page);
    expect(csrfToken).toBeTruthy();
    expect(csrfToken.length).toBe(64); // HMAC-SHA-256 as 64 hex chars
  });
});
