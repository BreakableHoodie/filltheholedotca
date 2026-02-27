import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyTotpCode } from '$lib/server/admin-totp';
import {
	checkAuthRateLimit,
	recordAuthAttempt,
	createAdminSession,
	buildSessionCookie
} from '$lib/server/admin-auth';
import { decryptTotpSecret, verifyBackupCode } from '$lib/server/admin-crypto';
import { generateCsrfToken, buildCsrfCookie } from '$lib/server/admin-csrf';
import { hashIp } from '$lib/hash';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const verifySchema = z.object({
	mfaToken: z.string().uuid(),
	code: z.string().min(1).max(20),
	rememberDevice: z.boolean().optional().default(false)
});

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = verifySchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'MFA token and code are required');

	const { mfaToken, code, rememberDevice } = parsed.data;
	const ipHash = await hashIp(getClientAddress());
	const userAgent = request.headers.get('user-agent') ?? 'unknown';
	const isSecure = request.url.startsWith('https://');

	// Look up challenge (joins to admin_users for account status + TOTP secret)
	const { data: challenge } = await adminSupabase
		.from('admin_mfa_challenges')
		.select(`
      id, user_id, ip_address, user_agent,
      admin_users!inner (
        id, email, first_name, last_name, role, is_active, totp_enabled, totp_secret, backup_codes,
        last_used_totp_code, last_used_totp_at
      )
    `)
		.eq('token', mfaToken)
		.eq('used', false)
		.gt('expires_at', new Date().toISOString())
		.maybeSingle();

	if (!challenge) {
		await recordAuthAttempt({
			email: 'unknown',
			ipHash,
			userAgent,
			attemptType: 'mfa',
			success: false,
			failureReason: 'invalid_or_expired_token'
		});
		throw error(401, 'Invalid or expired MFA token');
	}

	const dbUser = (challenge as unknown as { admin_users: Record<string, unknown> }).admin_users;

	// Verify IP/UA match (prevents token reuse from a different device)
	const ipMismatch =
		challenge.ip_address && challenge.ip_address !== 'unknown' && challenge.ip_address !== ipHash;
	const uaMismatch =
		challenge.user_agent &&
		challenge.user_agent !== 'unknown' &&
		challenge.user_agent !== userAgent;

	if (ipMismatch || uaMismatch) {
		await recordAuthAttempt({
			userId: challenge.user_id as string,
			email: dbUser['email'] as string,
			ipHash,
			userAgent,
			attemptType: 'mfa',
			success: false,
			failureReason: 'challenge_mismatch'
		});
		throw error(401, 'MFA session mismatch');
	}

	if (!dbUser['is_active']) {
		throw error(403, 'Account has been deactivated. Contact an administrator.');
	}

	// Rate limit on MFA failures
	const rateCheck = await checkAuthRateLimit(dbUser['email'] as string, ipHash, 'mfa');
	if (!rateCheck.allowed) {
		throw error(
			429,
			`Too many failed MFA attempts. Try again in ${rateCheck.remainingMinutes} minutes.`
		);
	}

	let verified = false;
	let remainingBackupCodes: string[] | null = null;
	let usedBackupCode = false;

	// Try TOTP first
	if (dbUser['totp_enabled'] && dbUser['totp_secret']) {
		try {
			const secret = await decryptTotpSecret(dbUser['totp_secret'] as string);
			const totpValid = await verifyTotpCode(secret, code);

			if (totpValid) {
				// Replay prevention: reject if this exact code was accepted within the last 90s.
				// TOTP codes are valid for up to ~60s (current + adjacent period with window=1).
				// A 90s window ensures we cover both periods plus a small clock-skew buffer.
				const lastCode = dbUser['last_used_totp_code'] as string | null;
				const lastAt = dbUser['last_used_totp_at'] as string | null;
				const withinWindow = lastAt && Date.now() - new Date(lastAt).getTime() < 90_000;
				if (lastCode === code && withinWindow) {
					await recordAuthAttempt({
						userId: challenge.user_id as string,
						email: dbUser['email'] as string,
						ipHash,
						userAgent,
						attemptType: 'mfa',
						success: false,
						failureReason: 'totp_replay'
					});
					throw error(401, 'Invalid authentication code');
				}
				verified = true;
			}
		} catch (e) {
			if ((e as { status?: number }).status === 401) throw e;
			console.error('[mfa/verify] TOTP decrypt/verify failed:', e);
		}
	}

	// Fall back to backup codes (backup codes are single-use by design — no replay risk)
	if (!verified && dbUser['backup_codes']) {
		try {
			const hashes: string[] = JSON.parse(dbUser['backup_codes'] as string);
			const result = await verifyBackupCode(code, hashes);
			if (result.valid) {
				verified = true;
				usedBackupCode = true;
				remainingBackupCodes = result.remaining;
			}
		} catch (e) {
			console.error('[mfa/verify] Backup code check failed:', e);
		}
	}

	if (!verified) {
		await recordAuthAttempt({
			userId: challenge.user_id as string,
			email: dbUser['email'] as string,
			ipHash,
			userAgent,
			attemptType: 'mfa',
			success: false,
			failureReason: 'invalid_code'
		});
		throw error(401, 'Invalid authentication code');
	}

	// Atomically mark challenge as used (prevents replay — only one concurrent request wins)
	const { data: updated } = await adminSupabase
		.from('admin_mfa_challenges')
		.update({ used: true, used_at: new Date().toISOString() })
		.eq('id', challenge.id)
		.eq('used', false)
		.select('id');

	if (!updated || updated.length === 0) {
		throw error(401, 'MFA challenge already used');
	}

	// Record last-used TOTP code to prevent replay within the validity window
	if (!usedBackupCode) {
		await adminSupabase
			.from('admin_users')
			.update({ last_used_totp_code: code, last_used_totp_at: new Date().toISOString() })
			.eq('id', challenge.user_id);
	}

	// Consume backup code if used
	if (usedBackupCode && remainingBackupCodes !== null) {
		await adminSupabase
			.from('admin_users')
			.update({
				backup_codes:
					remainingBackupCodes.length > 0 ? JSON.stringify(remainingBackupCodes) : null
			})
			.eq('id', challenge.user_id);
	}

	// Create session
	const sessionId = await createAdminSession(challenge.user_id as string, ipHash, userAgent);
	const csrfToken = await generateCsrfToken(sessionId);

	await adminSupabase
		.from('admin_users')
		.update({ last_login_at: new Date().toISOString() })
		.eq('id', challenge.user_id);

	await recordAuthAttempt({
		userId: challenge.user_id as string,
		email: dbUser['email'] as string,
		ipHash,
		userAgent,
		attemptType: 'mfa',
		success: true
	});

	const headers = new Headers({ 'Content-Type': 'application/json' });
	headers.append('Set-Cookie', buildSessionCookie(sessionId, isSecure));
	headers.append('Set-Cookie', buildCsrfCookie(csrfToken, isSecure));

	// Trusted device
	if (rememberDevice) {
		try {
			const trustedToken = crypto.randomUUID();
			const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
			await adminSupabase.from('admin_trusted_devices').insert({
				token: trustedToken,
				user_id: challenge.user_id,
				ip_address: ipHash,
				user_agent: userAgent,
				expires_at: expiresAt
			});
			const deviceCookieParts = [
				`admin_trusted_device=${trustedToken}`,
				'HttpOnly',
				'SameSite=Strict',
				'Path=/',
				`Expires=${new Date(expiresAt).toUTCString()}`
			];
			if (isSecure) deviceCookieParts.push('Secure');
			headers.append('Set-Cookie', deviceCookieParts.join('; '));
		} catch (e) {
			// Non-fatal — don't fail login if trusted device creation fails
			console.error('[mfa/verify] Failed to create trusted device:', e);
		}
	}

	return new Response(
		JSON.stringify({
			ok: true,
			user: {
				id: challenge.user_id,
				email: dbUser['email'],
				firstName: dbUser['first_name'],
				lastName: dbUser['last_name'],
				role: dbUser['role']
			},
			usedBackupCode
		}),
		{ status: 200, headers }
	);
};
