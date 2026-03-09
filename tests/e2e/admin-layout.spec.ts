import { test, expect } from '@playwright/test';

/**
 * Admin layout tests.
 *
 * Authenticated sidebar behaviour (drawer open/close, keyboard Escape, focus
 * restoration) requires a live Supabase connection and a valid admin account —
 * those tests are covered by the manual test plan in the PR.
 *
 * The tests below cover what is verifiable in every CI environment:
 *   • unauthenticated redirect behaviour
 *   • login page accessibility at a narrow (mobile) viewport
 *   • the sidebar / mobile top-bar are NOT rendered when there is no session
 *     (ensures the `inert`/`aria-hidden` accessibility fix does not regress)
 */

test.describe('Admin layout — unauthenticated redirect', () => {
	test('visiting /admin without auth redirects to login', async ({ page }) => {
		await page.goto('/admin');
		await expect(page).toHaveURL(/\/admin\/login/);
	});

	test('visiting /admin/potholes without auth redirects to login', async ({ page }) => {
		await page.goto('/admin/potholes');
		await expect(page).toHaveURL(/\/admin\/login/);
	});

	test('visiting /admin/photos without auth redirects to login', async ({ page }) => {
		await page.goto('/admin/photos');
		await expect(page).toHaveURL(/\/admin\/login/);
	});

	test('visiting /admin/audit without auth redirects to login', async ({ page }) => {
		await page.goto('/admin/audit');
		await expect(page).toHaveURL(/\/admin\/login/);
	});
});

test.describe('Admin login page — mobile viewport', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('login page renders the sign-in heading at narrow viewport', async ({ page }) => {
		await page.goto('/admin/login');
		await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
	});

	test('login form has labelled email and password fields', async ({ page }) => {
		await page.goto('/admin/login');
		await expect(page.getByLabel(/email/i)).toBeVisible();
		await expect(page.getByLabel(/password/i)).toBeVisible();
	});

	test('submit button is present and enabled', async ({ page }) => {
		await page.goto('/admin/login');
		const btn = page.getByRole('button', { name: /sign in/i });
		await expect(btn).toBeVisible();
		await expect(btn).toBeEnabled();
	});

	test('no admin sidebar is rendered for unauthenticated routes', async ({ page }) => {
		await page.goto('/admin/login');
		// Sidebar only renders inside the {#if user} branch — must be absent when not logged in
		await expect(page.locator('aside[aria-label="Admin navigation"]')).not.toBeAttached();
	});

	test('no mobile top-bar / hamburger button is rendered for unauthenticated routes', async ({
		page
	}) => {
		await page.goto('/admin/login');
		// Hamburger toggle only renders inside the {#if user} branch
		await expect(page.getByRole('button', { name: /toggle navigation/i })).not.toBeAttached();
	});
});

test.describe('Admin login page — desktop viewport', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('login page title is correct', async ({ page }) => {
		await page.goto('/admin/login');
		await expect(page).toHaveTitle(/sign in/i);
	});

	test('no sidebar is rendered on the desktop login page', async ({ page }) => {
		await page.goto('/admin/login');
		await expect(page.locator('aside[aria-label="Admin navigation"]')).not.toBeAttached();
	});
});
