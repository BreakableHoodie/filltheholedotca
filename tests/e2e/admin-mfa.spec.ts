import { test, expect } from '@playwright/test'

// Shared helper: fill the login form and submit.
async function submitLoginForm(
	page: import('@playwright/test').Page,
	email: string,
	password: string,
) {
	await page.goto('/admin/login')
	await expect(
		page.getByRole('heading', { name: 'Sign in' }),
	).toBeVisible()
	await page.fill('input[name="email"]', email)
	await page.fill('input[name="password"]', password)
	await page.click('button[type="submit"]')
}

// Helper: log in with fixture credentials and complete MFA, returning the CSRF
// token (readable from the non-HttpOnly admin_csrf cookie after redirect).
async function loginWithMfa(
	page: import('@playwright/test').Page,
	{ rememberDevice = false } = {},
) {
	await submitLoginForm(page, 'e2e-mfa@test.local', 'e2e-password')
	await page.waitForURL(/\/admin\/login\/mfa/)

	if (rememberDevice) {
		await page.check('input[name="rememberDevice"]')
	}

	// The MFA page auto-submits on 6 digits — filling triggers the $effect.
	await page.fill('input[name="code"]', '000000')
	await page.waitForURL(/\/admin\//)

	const csrfToken = await page.evaluate(() =>
		document.cookie
			.split('; ')
			.find((c) => c.startsWith('admin_csrf='))
			?.split('=')[1] ?? '',
	)
	return { csrfToken }
}

test.describe('Admin — MFA login flow', () => {
	test('login form redirects to MFA page on valid credentials', async ({
		page,
	}) => {
		await submitLoginForm(page, 'e2e-mfa@test.local', 'e2e-password')
		await expect(page).toHaveURL(/\/admin\/login\/mfa/)
		await expect(
			page.getByRole('heading', { name: 'Two-factor authentication' }),
		).toBeVisible()
	})

	test('wrong password shows an error and stays on login', async ({
		page,
	}) => {
		await submitLoginForm(page, 'e2e-mfa@test.local', 'wrong-password')
		await expect(
			page.getByText('Invalid email or password'),
		).toBeVisible()
		await expect(page).toHaveURL(/\/admin\/login/)
		await expect(page).not.toHaveURL(/\/admin\/login\/mfa/)
	})

	test('wrong MFA code shows an error and stays on MFA page', async ({
		page,
	}) => {
		await submitLoginForm(page, 'e2e-mfa@test.local', 'e2e-password')
		await page.waitForURL(/\/admin\/login\/mfa/)

		await page.fill('input[name="code"]', '999999')
		await page.click('button[type="submit"]')
		await expect(
			page.getByText('Invalid code. Please try again.'),
		).toBeVisible()
		await expect(page).toHaveURL(/\/admin\/login\/mfa/)
	})

	test('correct MFA code redirects to admin area', async ({ page }) => {
		await loginWithMfa(page)
		await expect(page).toHaveURL(/\/admin\//)
	})

	test('MFA page renders TOTP and backup code modes', async ({ page }) => {
		await submitLoginForm(page, 'e2e-mfa@test.local', 'e2e-password')
		await page.waitForURL(/\/admin\/login\/mfa/)

		// TOTP mode (default)
		await expect(
			page.getByRole('heading', { name: 'Two-factor authentication' }),
		).toBeVisible()
		await expect(
			page.getByLabel('Authenticator code'),
		).toBeVisible()

		// Switch to backup code mode
		await page.click('button:has-text("Use a backup code instead")')
		await expect(
			page.getByRole('heading', { name: 'Enter backup code' }),
		).toBeVisible()
		await expect(page.getByLabel('Backup code')).toBeVisible()

		// Switch back
		await page.click('button:has-text("Use authenticator code instead")')
		await expect(
			page.getByRole('heading', { name: 'Two-factor authentication' }),
		).toBeVisible()
	})

	test("'Remember this device' sets the trusted device cookie", async ({
		page,
	}) => {
		await loginWithMfa(page, { rememberDevice: true })

		const cookies = await page.context().cookies()
		const trustedCookie = cookies.find(
			(c) => c.name === 'admin_trusted_device',
		)
		expect(trustedCookie).toBeDefined()
		expect(trustedCookie!.value).toBe('e2e-trusted-device-token')
		expect(trustedCookie!.httpOnly).toBe(true)
	})

	test('trusted device cookie bypasses MFA on second login', async ({
		page,
	}) => {
		// First login with "remember device"
		await loginWithMfa(page, { rememberDevice: true })

		// Navigate away (simulate a new session start by going back to login)
		await page.goto('/admin/login')

		// Log in again — trusted device cookie should skip the MFA challenge
		await page.fill('input[name="email"]', 'e2e-mfa@test.local')
		await page.fill('input[name="password"]', 'e2e-password')
		await page.click('button[type="submit"]')

		// Should land in admin without passing through /mfa
		await expect(page).toHaveURL(/\/admin\//)
		await expect(page).not.toHaveURL(/\/admin\/login\/mfa/)
	})

	test('back link on MFA page returns to login', async ({ page }) => {
		await submitLoginForm(page, 'e2e-mfa@test.local', 'e2e-password')
		await page.waitForURL(/\/admin\/login\/mfa/)
		await page.click('a:has-text("Back to sign in")')
		await expect(page).toHaveURL(/\/admin\/login$/)
	})

	test('admin CSRF token is set after MFA login', async ({ page }) => {
		const { csrfToken } = await loginWithMfa(page)
		expect(csrfToken).toBeTruthy()
		expect(csrfToken.length).toBe(64) // HMAC-SHA-256 as 64 hex chars
	})
})
