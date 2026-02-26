import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { verifyTotpCode } from '$lib/server/admin-totp';
import { decryptTotpSecret, verifyBackupCode } from '$lib/server/admin-crypto';
import {
	checkAuthRateLimit,
	recordAuthAttempt,
	createAdminSession,
	validateAdminSession,
	SESSION_COOKIE,
	TRUSTED_DEVICE_COOKIE
} from '$lib/server/admin-auth';
import { generateCsrfToken, CSRF_COOKIE } from '$lib/server/admin-csrf';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const load: PageServerLoad = async ({ cookies, url }) => {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (sessionId) {
		const result = await validateAdminSession(sessionId);
		if (result) {
			const rawNext = url.searchParams.get('next') ?? '/admin/photos';
			throw redirect(302, rawNext.startsWith('/admin') ? rawNext : '/admin/photos');
		}
	}
	const token = url.searchParams.get('token');
	if (!token) throw redirect(302, '/admin/login');
	return {
		token,
		next: url.searchParams.get('next') ?? '/admin/photos'
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const formData = await request.formData();
		const mfaToken = formData.get('token')?.toString() ?? '';
		const code = formData.get('code')?.toString().replace(/\s/g, '') ?? '';
		const rememberDevice = formData.get('rememberDevice') === 'on';
		const rawNext = formData.get('next')?.toString() ?? '/admin/photos';
		const next = rawNext.startsWith('/admin') ? rawNext : '/admin/photos';

		const ipAddress = getClientAddress();
		const userAgent = request.headers.get('user-agent') ?? 'unknown';
		const isSecure = url.protocol === 'https:';

		if (!mfaToken || !code) {
			return fail(400, { error: 'Verification code is required', token: mfaToken, next });
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
			};
		};

		const { data: challenge } = await adminSupabase
			.from('admin_mfa_challenges')
			.select(
				`id, user_id, ip_address, user_agent,
       admin_users!inner ( id, email, is_active, totp_enabled, totp_secret, backup_codes )`
			)
			.eq('token', mfaToken)
			.eq('used', false)
			.gt('expires_at', new Date().toISOString())
			.maybeSingle();

		if (!challenge) {
			return fail(401, {
				error: 'Invalid or expired MFA session. Please log in again.',
				token: mfaToken,
				next
			});
		}

		const row = challenge as unknown as ChallengeRow;
		const dbUser = row.admin_users;

		// Prevent token reuse from a different network context
		const ipMismatch =
			row.ip_address && row.ip_address !== 'unknown' && row.ip_address !== ipAddress;
		const uaMismatch =
			row.user_agent && row.user_agent !== 'unknown' && row.user_agent !== userAgent;
		if (ipMismatch || uaMismatch) {
			return fail(401, {
				error: 'Session mismatch. Please log in again.',
				token: mfaToken,
				next
			});
		}

		if (!dbUser.is_active) {
			return fail(403, { error: 'Account has been deactivated.', token: mfaToken, next });
		}

		const rateCheck = await checkAuthRateLimit(dbUser.email, ipAddress, 'mfa');
		if (!rateCheck.allowed) {
			return fail(429, {
				error: `Too many failed attempts. Try again in ${rateCheck.remainingMinutes} minutes.`,
				token: mfaToken,
				next
			});
		}

		let verified = false;
		let remainingBackupCodes: string[] | null = null;
		let usedBackupCode = false;

		if (dbUser.totp_enabled && dbUser.totp_secret) {
			try {
				const secret = await decryptTotpSecret(dbUser.totp_secret);
				verified = await verifyTotpCode(secret, code);
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
				ipAddress,
				userAgent,
				attemptType: 'mfa',
				success: false,
				failureReason: 'invalid_code'
			});
			return fail(401, { error: 'Invalid code. Please try again.', token: mfaToken, next });
		}

		// Atomically mark challenge used (replay protection)
		const { data: updated } = await adminSupabase
			.from('admin_mfa_challenges')
			.update({ used: true, used_at: new Date().toISOString() })
			.eq('id', row.id)
			.eq('used', false)
			.select('id');

		if (!updated || updated.length === 0) {
			return fail(401, {
				error: 'MFA session already completed. Please log in again.',
				token: mfaToken,
				next
			});
		}

		if (usedBackupCode && remainingBackupCodes !== null) {
			await adminSupabase
				.from('admin_users')
				.update({
					backup_codes: remainingBackupCodes.length > 0 ? JSON.stringify(remainingBackupCodes) : null
				})
				.eq('id', row.user_id);
		}

		const sessionId = await createAdminSession(row.user_id, ipAddress, userAgent);
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
			.eq('id', row.user_id);
		await recordAuthAttempt({
			userId: row.user_id,
			email: dbUser.email,
			ipAddress,
			userAgent,
			attemptType: 'mfa',
			success: true
		});

		if (rememberDevice) {
			try {
				const deviceToken = crypto.randomUUID();
				const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
				await adminSupabase.from('admin_trusted_devices').insert({
					token: deviceToken,
					user_id: row.user_id,
					ip_address: ipAddress,
					user_agent: userAgent,
					expires_at: expiresAt
				});
				cookies.set(TRUSTED_DEVICE_COOKIE, deviceToken, {
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
