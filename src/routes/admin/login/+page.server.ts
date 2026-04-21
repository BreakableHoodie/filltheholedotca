import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { verifyPassword, hashToken } from '$lib/server/admin-crypto';
import {
	checkAuthRateLimit,
	recordAuthAttempt,
	createAdminSession,
	validateAdminSession,
	SESSION_COOKIE,
	TRUSTED_DEVICE_COOKIE
} from '$lib/server/admin-auth';
import { generateCsrfToken, CSRF_COOKIE } from '$lib/server/admin-csrf';
import { hashIp } from '$lib/hash';
import { getAdminClient } from '$lib/server/supabase';
export const load: PageServerLoad = async ({ cookies, url }) => {
	// Redirect logged-in users away from login page
	const sessionId = cookies.get(SESSION_COOKIE);
	if (sessionId) {
		const result = await validateAdminSession(sessionId);
		if (result) {
			const rawNext = url.searchParams.get('next') ?? '/admin/photos';
			throw redirect(302, rawNext.startsWith('/admin') ? rawNext : '/admin/photos');
		}
	}
	return { next: url.searchParams.get('next') ?? '/admin/photos' };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const formData = await request.formData();
		const email = (formData.get('email')?.toString() ?? '').toLowerCase().trim();
		const password = formData.get('password')?.toString() ?? '';
		const rawNext = formData.get('next')?.toString() ?? '/admin/photos';
		// Prevent open redirect
		const next = rawNext.startsWith('/admin') ? rawNext : '/admin/photos';

		const ipHash = await hashIp(getClientAddress());
		const userAgent = request.headers.get('user-agent') ?? 'unknown';
		// M1: Use build-time flag — url.protocol can be spoofed via reverse proxy.
		const isSecure = import.meta.env.PROD;

		const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse({
			email,
			password
		});
		if (!parsed.success) {
			return fail(400, { error: 'Email and password are required', email });
		}

		// DB-backed rate limit (same as the API endpoint) — no separate in-memory limiter on
		// this form handler; the shared checkAuthRateLimit covers both paths.
		const rateCheck = await checkAuthRateLimit(email, ipHash, 'login');
		if (!rateCheck.allowed) {
			return fail(429, {
				error: `Too many attempts. Try again in ${rateCheck.remainingMinutes} minutes.`,
				email
			});
		}

		const { data: user } = await getAdminClient()
			.from('admin_users')
			.select('id, email, first_name, last_name, role, is_active, activated_at, password_hash, totp_enabled')
			.eq('email', email)
			.maybeSingle();

		if (!user) {
			await recordAuthAttempt({
				email,
				ipHash,
				userAgent,
				attemptType: 'login',
				success: false,
				failureReason: 'user_not_found'
			});
			return fail(401, { error: 'Invalid email or password', email });
		}

		// Check account status BEFORE verifyPassword to avoid timing oracle:
		// verifyPassword runs slow PBKDF2 — checking is_active after it leaks
		// whether a given password is correct for an inactive account.
		// Return the same generic message for both inactive states to prevent
		// account enumeration — an unauthenticated caller must not be able to
		// determine whether an email belongs to an active/inactive account.
		if (!user.activated_at) {
			await recordAuthAttempt({
				userId: user.id,
				email,
				ipHash,
				userAgent,
				attemptType: 'login',
				success: false,
				failureReason: 'activation_required'
			});
			return fail(401, { error: 'Invalid credentials.', email });
		}

		if (!user.is_active) {
			await recordAuthAttempt({
				userId: user.id,
				email,
				ipHash,
				userAgent,
				attemptType: 'login',
				success: false,
				failureReason: 'account_disabled'
			});
			return fail(401, { error: 'Invalid credentials.', email });
		}

		const passwordOk = await verifyPassword(password, user.password_hash);
		if (!passwordOk) {
			await recordAuthAttempt({
				userId: user.id,
				email,
				ipHash,
				userAgent,
				attemptType: 'login',
				success: false,
				failureReason: 'wrong_password'
			});
			return fail(401, { error: 'Invalid email or password', email });
		}

		// Check trusted device before requiring MFA
		if (user.totp_enabled) {
			const trustedToken = cookies.get(TRUSTED_DEVICE_COOKIE);
			if (trustedToken) {
				// H1 fix: hash the raw cookie value before comparing — only hashes are stored in DB.
				const trustedTokenHash = await hashToken(trustedToken);
				const { data: trusted } = await getAdminClient()
					.from('admin_trusted_devices')
					.select('id')
					.eq('token', trustedTokenHash)
					.eq('user_id', user.id)
					.gt('expires_at', new Date().toISOString())
					.maybeSingle();

				if (trusted) {
					const sessionId = await createAdminSession(user.id, ipHash, userAgent);
					const csrfToken = await generateCsrfToken(sessionId);
					cookies.set(SESSION_COOKIE, sessionId, {
						httpOnly: true,
						sameSite: 'strict',
						path: '/',
						secure: isSecure,
						maxAge: 24 * 60 * 60
					});
					cookies.set(CSRF_COOKIE, csrfToken, {
						httpOnly: false,
						sameSite: 'strict',
						path: '/',
						secure: isSecure,
						maxAge: 24 * 60 * 60
					});
					await getAdminClient()
						.from('admin_users')
						.update({ last_login_at: new Date().toISOString() })
						.eq('id', user.id);
					await recordAuthAttempt({
						userId: user.id,
						email,
						ipHash,
						userAgent,
						attemptType: 'login',
						success: true
					});
					throw redirect(302, next);
				}
			}

			// MFA required — create challenge.
			// SEC-1 fix: invalidate any existing valid challenges for this user before
			// inserting a new one. Without this, rapid repeat submissions accumulate
			// multiple simultaneously valid tokens that collectively expand the
			// attacker's TOTP-guess window.
			const now = new Date().toISOString();
			await getAdminClient()
				.from('admin_mfa_challenges')
				.update({ used: true, used_at: now })
				.eq('user_id', user.id)
				.eq('used', false)
				.gt('expires_at', now);

			// M2 fix: token is stored in an HttpOnly cookie rather than the URL query string.
			// A URL token leaks into browser history, server logs, and Referer headers.
			const mfaToken = crypto.randomUUID();
			await getAdminClient().from('admin_mfa_challenges').insert({
				token: mfaToken,
				user_id: user.id,
				ip_address: ipHash,
				user_agent: userAgent,
				expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
			});
			cookies.set('admin_mfa_pending', mfaToken, {
				httpOnly: true,
				sameSite: 'strict',
				path: '/admin/login',
				secure: isSecure,
				maxAge: 5 * 60 // matches challenge expiry
			});
			throw redirect(302, `/admin/login/mfa?next=${encodeURIComponent(next)}`);
		}

		// No MFA enrolled — create session directly
		const sessionId = await createAdminSession(user.id, ipHash, userAgent);
		const csrfToken = await generateCsrfToken(sessionId);
		cookies.set(SESSION_COOKIE, sessionId, {
			httpOnly: true,
			sameSite: 'strict',
			path: '/',
			secure: isSecure,
			maxAge: 24 * 60 * 60
		});
		cookies.set(CSRF_COOKIE, csrfToken, {
			httpOnly: false,
			sameSite: 'strict',
			path: '/',
			secure: isSecure,
			maxAge: 24 * 60 * 60
		});
		await getAdminClient()
			.from('admin_users')
			.update({ last_login_at: new Date().toISOString() })
			.eq('id', user.id);
		await recordAuthAttempt({
			userId: user.id,
			email,
			ipHash,
			userAgent,
			attemptType: 'login',
			success: true
		});
		throw redirect(302, next);
	}
};
