import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyPassword } from '$lib/server/admin-crypto';
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

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
	default: async ({ request, cookies, getClientAddress, url }) => {
		const formData = await request.formData();
		const email = (formData.get('email')?.toString() ?? '').toLowerCase().trim();
		const password = formData.get('password')?.toString() ?? '';
		const rawNext = formData.get('next')?.toString() ?? '/admin/photos';
		// Prevent open redirect
		const next = rawNext.startsWith('/admin') ? rawNext : '/admin/photos';

		const ipHash = await hashIp(getClientAddress());
		const userAgent = request.headers.get('user-agent') ?? 'unknown';
		const isSecure = url.protocol === 'https:';

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

		const { data: user } = await adminSupabase
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
			return fail(403, {
				error: 'Your account has not been activated yet. Contact an administrator.',
				email
			});
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
			return fail(403, {
				error: 'Your account has been deactivated. Contact an administrator.',
				email
			});
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
				const { data: trusted } = await adminSupabase
					.from('admin_trusted_devices')
					.select('id')
					.eq('token', trustedToken)
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
					await adminSupabase
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

			// MFA required — create challenge
			const mfaToken = crypto.randomUUID();
			await adminSupabase.from('admin_mfa_challenges').insert({
				token: mfaToken,
				user_id: user.id,
				ip_address: ipHash,
				user_agent: userAgent,
				expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
			});
			throw redirect(302, `/admin/login/mfa?token=${mfaToken}&next=${encodeURIComponent(next)}`);
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
		await adminSupabase
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
