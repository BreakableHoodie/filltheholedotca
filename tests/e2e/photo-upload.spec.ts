import { test, expect } from '@playwright/test'

// Minimal valid JPEG: SOI + JFIF APP0 marker + EOI.
// The server's magic-byte check only inspects bytes[0..2] = FF D8 FF.
const MINIMAL_JPEG = Buffer.from([
	0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
	0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
])

// Inside-region fixture pothole coordinates
const FIXTURE_LAT = 43.45
const FIXTURE_LNG = -80.49

async function createFixturePothole(
	request: import('@playwright/test').APIRequestContext,
): Promise<string> {
	const r = await request.post('/api/report', {
		data: { lat: FIXTURE_LAT, lng: FIXTURE_LNG, description: 'Minor damage' },
	})
	expect(r.status()).toBe(200)
	const d = await r.json()
	return d.id as string
}

async function uploadPhoto(
	request: import('@playwright/test').APIRequestContext,
	potholeId: string,
	extraHeaders?: Record<string, string>,
) {
	return request.post('/api/photos', {
		headers: extraHeaders,
		multipart: {
			photo: {
				name: 'test.jpg',
				mimeType: 'image/jpeg',
				buffer: MINIMAL_JPEG,
			},
			pothole_id: potholeId,
		},
	})
}

// Log in with fixture credentials and return the CSRF token from the cookie.
async function adminLogin(page: import('@playwright/test').Page) {
	await page.goto('/admin/login')
	await page.getByLabel('Email').fill('e2e-mfa@test.local')
	await page.getByLabel('Password').fill('e2e-password')
	await page.getByRole('button', { name: 'Sign in' }).click()
	await page.waitForURL(/\/admin\/login\/mfa/)
	// The MFA page auto-submits on 6 digits — filling triggers the $effect.
	await page.getByLabel('Authenticator code').fill('000000')
	await page.waitForURL(/\/admin\//)

	return page.evaluate(() =>
		document.cookie
			.split('; ')
			.find((c) => c.startsWith('admin_csrf='))
			?.split('=')[1] ?? '',
	)
}

test.describe('Photo upload API', () => {
	test.beforeEach(async ({ request }) => {
		await request.delete('/api/report') // reset fixture pothole store
		await request.delete('/api/photos') // reset fixture photo store
	})

	test('valid JPEG upload is accepted and returns a photo id', async ({
		request,
	}) => {
		const potholeId = await createFixturePothole(request)
		const r = await uploadPhoto(request, potholeId)

		expect(r.status()).toBe(200)
		const d = await r.json()
		expect(d.ok).toBe(true)
		expect(typeof d.id).toBe('string')
		expect(d.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		)
	})

	test('simulated content moderation rejection returns 422', async ({
		request,
	}) => {
		const potholeId = await createFixturePothole(request)
		const r = await uploadPhoto(request, potholeId, {
			'x-e2e-moderation': 'reject',
		})

		expect(r.status()).toBe(422)
	})

	test('non-image file is rejected with 400', async ({ request }) => {
		const potholeId = await createFixturePothole(request)
		const r = await request.post('/api/photos', {
			multipart: {
				photo: {
					name: 'evil.txt',
					mimeType: 'text/plain',
					buffer: Buffer.from('not an image'),
				},
				pothole_id: potholeId,
			},
		})
		expect(r.status()).toBe(400)
	})

	test('missing pothole_id returns 400', async ({ request }) => {
		const r = await request.post('/api/photos', {
			multipart: {
				photo: {
					name: 'test.jpg',
					mimeType: 'image/jpeg',
					buffer: MINIMAL_JPEG,
				},
				// pothole_id intentionally omitted
			},
		})
		expect(r.status()).toBe(400)
	})

	test('invalid UUID for pothole_id returns 400', async ({ request }) => {
		const r = await request.post('/api/photos', {
			multipart: {
				photo: {
					name: 'test.jpg',
					mimeType: 'image/jpeg',
					buffer: MINIMAL_JPEG,
				},
				pothole_id: 'not-a-uuid',
			},
		})
		expect(r.status()).toBe(400)
	})

	test('unknown pothole UUID returns 404', async ({ request }) => {
		const r = await request.post('/api/photos', {
			multipart: {
				photo: {
					name: 'test.jpg',
					mimeType: 'image/jpeg',
					buffer: MINIMAL_JPEG,
				},
				pothole_id: '00000000-0000-4000-8000-000000000000',
			},
		})
		expect(r.status()).toBe(404)
	})
})

test.describe('Photo moderation — admin API', () => {
	test.beforeEach(async ({ request }) => {
		await request.delete('/api/report')
		await request.delete('/api/photos')
	})

	test('admin can approve a pending photo', async ({ page, request }) => {
		// Set up fixture data
		const potholeId = await createFixturePothole(request)
		const uploadRes = await uploadPhoto(request, potholeId)
		const { id: photoId } = await uploadRes.json()

		// Log in as fixture admin
		const csrfToken = await adminLogin(page)
		expect(csrfToken).toBeTruthy()

		// Approve via admin API (uses page.request so session cookie is included)
		const res = await page.request.patch(`/api/admin/photo/${photoId}`, {
			headers: { 'x-csrf-token': csrfToken },
			data: { action: 'approve' },
		})

		expect(res.status()).toBe(200)
		const d = await res.json()
		expect(d.ok).toBe(true)
		expect(d.moderation_status).toBe('approved')
	})

	test('admin can reject a pending photo', async ({ page, request }) => {
		const potholeId = await createFixturePothole(request)
		const uploadRes = await uploadPhoto(request, potholeId)
		const { id: photoId } = await uploadRes.json()

		const csrfToken = await adminLogin(page)

		const res = await page.request.patch(`/api/admin/photo/${photoId}`, {
			headers: { 'x-csrf-token': csrfToken },
			data: { action: 'reject' },
		})

		expect(res.status()).toBe(200)
		const d = await res.json()
		expect(d.ok).toBe(true)
		expect(d.moderation_status).toBe('rejected')
	})

	test('admin can delete a photo', async ({ page, request }) => {
		const potholeId = await createFixturePothole(request)
		const uploadRes = await uploadPhoto(request, potholeId)
		const { id: photoId } = await uploadRes.json()

		const csrfToken = await adminLogin(page)

		const res = await page.request.delete(`/api/admin/photo/${photoId}`, {
			headers: { 'x-csrf-token': csrfToken },
		})

		expect(res.status()).toBe(200)
		const d = await res.json()
		expect(d.ok).toBe(true)
	})

	test('unauthenticated request to admin API returns 401', async ({
		request,
	}) => {
		const potholeId = await createFixturePothole(request)
		const uploadRes = await uploadPhoto(request, potholeId)
		const { id: photoId } = await uploadRes.json()

		// Use bare `request` (no session cookie) — should be rejected by hooks
		const res = await request.patch(`/api/admin/photo/${photoId}`, {
			data: { action: 'approve' },
		})

		expect(res.status()).toBe(401)
	})

	test('admin request without CSRF token returns 403', async ({
		page,
		request,
	}) => {
		const potholeId = await createFixturePothole(request)
		const uploadRes = await uploadPhoto(request, potholeId)
		const { id: photoId } = await uploadRes.json()

		await adminLogin(page)

		// Omit x-csrf-token header — CSRF check should reject this
		const res = await page.request.patch(`/api/admin/photo/${photoId}`, {
			data: { action: 'approve' },
		})

		expect(res.status()).toBe(403)
	})
})
