import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyTotpCode } from '$lib/server/admin-totp';
import { decryptTotpSecret, verifyBackupCode, hashToken } from '$lib/server/admin-crypto';
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
	const sessionId = cookies.get(SESSION_COOKIE);
	if (sessionId) {
		const result = await validateAdminSession(sessionId);
		if (result) {
			const rawNext = url.searchParams.get('next') ?? '/admin/photos';
			throw redirect(302, rawNext.startsWith('/admin') ? rawNext : '/admin/photos');
		}
	}
	// M2 fix: MFA token is in an HttpOnly cookie, not the URL.
	const token = cookies.get('admin_mfa_pending');
	if (!token) throw redirect(302, '/admin/login');
	return {
		next: url.searchParams.get('next') ?? '/admin/photos'
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const formData = await request.formData();
		// M2 fix: read MFA token from HttpOnly cookie, not form field (URL leak prevention).
		const mfaToken = cookies.get('admin_mfa_pending') ?? '';
		const code = formData.get('code')?.toString().replace(/\s/g, '') ?? '';
		const rememberDevice = formData.get('rememberDevice') === 'on';
		const rawNext = formData.get('next')?.toString() ?? '/admin/photos';
		const next = rawNext.startsWith('/admin') ? rawNext : '/admin/photos';

		const ipHash = await hashIp(getClientAddress());
		const userAgent = request.headers.get('user-agent') ?? 'unknown';
		// M1: Use build-time flag — url.protocol can be spoofed via reverse proxy.
		const isSecure = import.meta.env.PROD;

		if (!mfaToken || !code) {
			return fail(400, { error: 'Verification code is required', next });
		}

		if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true' && mfaToken === 'e2e-mfa-challenge-token') {
			if (code !== '000000') {
				return fail(401, { error: 'Invalid code. Please try again.', next });
			}
			cookies.delete('admin_mfa_pending', { path: '/admin/login' });
			const isSecure = import.meta.env.PROD;
			const csrfToken = await generateCsrfToken('e2e-session-id');
			cookies.set(SESSION_COOKIE, 'e2e-session-id', { httpOnly: true, sameSite: 'strict', path: '/', secure: isSecure, maxAge: 24 * 60 * 60 });
			cookies.set(CSRF_COOKIE, csrfToken, { httpOnly: false, sameSite: 'strict', path: '/', secure: isSecure, maxAge: 24 * 60 * 60 });
			if (rememberDevice) {
				cookies.set(TRUSTED_DEVICE_COOKIE, 'e2e-trusted-device-token', { httpOnly: true, sameSite: 'strict', path: '/', secure: isSecure, maxAge: 30 * 24 * 60 * 60 });
			}
			throw redirect(302, next);
		}

		type ChallengeRow = {
			id: string;
			user_id: string;
			ip_address: string | null;
			user_agent: string | null;
			admin_users: {
				id: string;
				email: string;
				is_active: boolean;
				totp_enabled: boolean;
				totp_secret: string | null;
				backup_codes: string | null;
				last_used_totp_code: string | null;
				last_used_totp_at: string | null;
			};
		};

		const { data: challenge } = await getAdminClient()
			.from('admin_mfa_challenges')
			.select(
				`id, user_id, ip_address, user_agent,
       admin_users!inner ( id, email, is_active, totp_enabled, totp_secret, backup_codes, last_used_totp_code, last_used_totp_at )`
			)
			.eq('token', mfaToken)
			.eq('used', false)
			.gt('expires_at', new Date().toISOString())
			.maybeSingle();

		if (!challenge) {
			return fail(401, {
				error: 'Invalid or expired MFA session. Please log in again.',
				next
			});
		}

		const row = challenge as unknown as ChallengeRow;
		const dbUser = row.admin_users;

		// Prevent token reuse from a different network context
		const ipMismatch =
			row.ip_address && row.ip_address !== 'unknown' && row.ip_address !== ipHash;
		const uaMismatch =
			row.user_agent && row.user_agent !== 'unknown' && row.user_agent !== userAgent;
		if (ipMismatch || uaMismatch) {
			return fail(401, {
				error: 'Session mismatch. Please log in again.',
				next
			});
		}

		if (!dbUser.is_active) {
			return fail(403, { error: 'Account has been deactivated.', next });
		}

		const rateCheck = await checkAuthRateLimit(dbUser.email, ipHash, 'mfa');
		if (!rateCheck.allowed) {
			return fail(429, {
				error: `Too many failed attempts. Try again in ${rateCheck.remainingMinutes} minutes.`,
				next
			});
		}

		let verified = false;
		let remainingBackupCodes: string[] | null = null;
		let usedBackupCode = false;

		if (dbUser.totp_enabled && dbUser.totp_secret) {
			try {
				const secret = await decryptTotpSecret(dbUser.totp_secret);
				const totpValid = await verifyTotpCode(secret, code);

				if (totpValid) {
					// Replay prevention: a TOTP code stays mathematically valid for ~60s.
					// Reject if this exact code was already accepted within the last 90s.
					const withinWindow =
						dbUser.last_used_totp_at &&
						Date.now() - new Date(dbUser.last_used_totp_at).getTime() < 90_000;
					if (dbUser.last_used_totp_code === code && withinWindow) {
						await recordAuthAttempt({
							userId: row.user_id,
							email: dbUser.email,
							ipHash,
							userAgent,
							attemptType: 'mfa',
							success: false,
							failureReason: 'totp_replay'
						});
						return fail(401, { error: 'Invalid code. Please try again.', next });
					}
					verified = true;
				}
			} catch (e) {
				console.error('[mfa] TOTP decrypt/verify failed:', e);
			}
		}

		if (!verified && dbUser.backup_codes) {
			try {
				const hashes: string[] = JSON.parse(dbUser.backup_codes);
				const result = await verifyBackupCode(code, hashes);
				if (result.valid) {
					verified = true;
					usedBackupCode = true;
					remainingBackupCodes = result.remaining;
				}
			} catch (e) {
				console.error('[mfa] Backup code check failed:', e);
			}
		}

		if (!verified) {
			await recordAuthAttempt({
				userId: row.user_id,
				email: dbUser.email,
				ipHash,
				userAgent,
				attemptType: 'mfa',
				success: false,
				failureReason: 'invalid_code'
			});
			return fail(401, { error: 'Invalid code. Please try again.', next });
		}

		// Atomically mark challenge used (replay protection)
		const { data: updated } = await getAdminClient()
			.from('admin_mfa_challenges')
			.update({ used: true, used_at: new Date().toISOString() })
			.eq('id', row.id)
			.eq('used', false)
			.select('id');

		if (!updated || updated.length === 0) {
			return fail(401, {
				error: 'MFA session already completed. Please log in again.',
				next
			});
		}

		// M2 fix: clear the one-time MFA pending cookie now that the challenge is consumed.
		cookies.delete('admin_mfa_pending', { path: '/admin/login' });

		// Record last-used TOTP code to prevent replay within the validity window
		if (!usedBackupCode) {
			await getAdminClient()
				.from('admin_users')
				.update({ last_used_totp_code: code, last_used_totp_at: new Date().toISOString() })
				.eq('id', row.user_id);
		}

		if (usedBackupCode && remainingBackupCodes !== null) {
			await getAdminClient()
				.from('admin_users')
				.update({
					backup_codes: remainingBackupCodes.length > 0 ? JSON.stringify(remainingBackupCodes) : null
				})
				.eq('id', row.user_id);
		}

		const sessionId = await createAdminSession(row.user_id, ipHash, userAgent);
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
			.eq('id', row.user_id);
		await recordAuthAttempt({
			userId: row.user_id,
			email: dbUser.email,
			ipHash,
			userAgent,
			attemptType: 'mfa',
			success: true
		});

		if (rememberDevice) {
			try {
				// H1 fix: store SHA-256 hash of the token, not the raw value.
				// Two UUIDs concatenated = 488 bits of entropy — well beyond brute-force range.
				const rawToken = crypto.randomUUID() + crypto.randomUUID();
				const tokenHash = await hashToken(rawToken);
				const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
				await getAdminClient().from('admin_trusted_devices').insert({
					token: tokenHash, // only the hash is stored
					user_id: row.user_id,
					ip_address: ipHash,
					user_agent: userAgent,
					expires_at: expiresAt
				});
				cookies.set(TRUSTED_DEVICE_COOKIE, rawToken, { // raw value goes to cookie
					httpOnly: true,
					sameSite: 'strict',
					path: '/',
					secure: isSecure,
					maxAge: 30 * 24 * 60 * 60
				});
			} catch (e) {
				console.error('[mfa] Failed to create trusted device:', e);
			}
		}

		throw redirect(302, next);
	}
};
