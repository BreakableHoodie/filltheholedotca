import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
	checkAuthRateLimit,
	recordAuthAttempt,
	createAdminSession,
	TRUSTED_DEVICE_COOKIE,
	buildSessionCookie
} from '$lib/server/admin-auth';
import { verifyPassword, hashToken } from '$lib/server/admin-crypto';
import { generateCsrfToken, buildCsrfCookie } from '$lib/server/admin-csrf';
import { hashIp } from '$lib/hash';
import { notify } from '$lib/server/pushover';
import { logError } from '$lib/server/observability';

function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const loginSchema = z.object({
	email: z.string().email().toLowerCase(),
	password: z.string().min(1)
});

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = loginSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Email and password are required');

	const { email, password } = parsed.data;
	const ipHash = await hashIp(getClientAddress());
	const userAgent = request.headers.get('user-agent') ?? 'unknown';

	// DB-backed rate limit: 5 failures / 10 min per email+IP
	const rateCheck = await checkAuthRateLimit(email, ipHash, 'login');
	if (!rateCheck.allowed) {
		// Only alert on the exact attempt that crossed the threshold to avoid
		// flooding the admin with one notification per blocked request.
		if (rateCheck.justBlocked) {
			void notify('security', {
				title: '🚨 Login rate limit triggered',
				message: `Too many failed login attempts (IP hash: ${ipHash.slice(0, 8)}…). Possible brute-force.`,
				priority: 1
			});
		}
		throw error(
			429,
			`Too many failed login attempts. Try again in ${rateCheck.remainingMinutes} minutes.`
		);
	}

	// Look up user
	const { data: user } = await getAdminClient()
		.from('admin_users')
		.select('id, email, password_hash, first_name, last_name, role, is_active, activated_at, totp_enabled')
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
		// Deliberate vague message to prevent user enumeration
		throw error(401, 'Invalid email or password');
	}

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
		return json({ error: 'Account not yet activated', requiresActivation: true }, { status: 403 });
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
		throw error(403, 'Account has been deactivated. Contact an administrator.');
	}

	const passwordValid = await verifyPassword(password, user.password_hash);
	if (!passwordValid) {
		await recordAuthAttempt({
			userId: user.id,
			email,
			ipHash,
			userAgent,
			attemptType: 'login',
			success: false,
			failureReason: 'invalid_password'
		});
		throw error(401, 'Invalid email or password');
	}

	// Check for trusted device before requiring MFA.
	// H1 fix: hash the raw cookie value before comparing — the DB stores only hashes.
	let skipMfa = false;
	if (user.totp_enabled) {
		const trustedToken = cookies.get(TRUSTED_DEVICE_COOKIE);
		if (trustedToken) {
			const trustedTokenHash = await hashToken(trustedToken);
			const { data: device } = await getAdminClient()
				.from('admin_trusted_devices')
				.select('user_id, user_agent')
				.eq('token', trustedTokenHash)
				.eq('user_id', user.id)
				.gt('expires_at', new Date().toISOString())
				.maybeSingle();
			if (device) {
				// Validate user agent — a changed UA likely means a different browser or
				// device. IP is intentionally not checked: trusted devices last 30 days and
				// legitimate users frequently change IPs (mobile↔WiFi, travel, VPN).
				const storedUa = device.user_agent as string | null;
				const uaMatch = !storedUa || storedUa === 'unknown' || storedUa === userAgent;
				if (uaMatch) {
					skipMfa = true;
					const { error: touchError } = await getAdminClient()
						.from('admin_trusted_devices')
						.update({ last_used_at: new Date().toISOString() })
						.eq('token', trustedTokenHash);
					if (touchError) logError('admin/trusted-device', 'Failed to update last_used_at', touchError);
				} else {
					// UA mismatch — possible cookie theft from a different device.
					// Don't skip MFA; surface for forensics.
					logError('admin/trusted_device', 'Trusted device UA mismatch — MFA not skipped', new Error('ua_mismatch'), {
						ipHashPrefix: ipHash.slice(0, 8)
					});
					void notify('security', {
						title: '⚠️ Trusted device UA mismatch',
						message: 'A trusted device cookie was presented from an unexpected browser. MFA was not skipped.',
						priority: 0
					});
				}
			}
		}
	}

	if (user.totp_enabled && !skipMfa) {
		// Issue MFA challenge — client must complete /api/admin/auth/mfa/verify
		const mfaToken = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

		// Reuse an existing valid challenge if one exists — prevents unbounded
		// row accumulation and makes repeated rapid logins idempotent.
		const { data: existingChallenge } = await getAdminClient()
			.from('admin_mfa_challenges')
			.select('token')
			.eq('user_id', user.id)
			.eq('used', false)
			.gt('expires_at', new Date().toISOString())
			.maybeSingle();
		if (existingChallenge) {
			return json({ mfaRequired: true, mfaToken: existingChallenge.token });
		}

		// Clean up expired/used challenges for this user
		const { error: cleanupError } = await getAdminClient()
			.from('admin_mfa_challenges')
			.delete()
			.eq('user_id', user.id)
			.or('used.eq.true,expires_at.lt.' + new Date().toISOString());
		if (cleanupError) logError('admin/mfa', 'Failed to clean up stale MFA challenges', cleanupError, { userId: user.id });

		await getAdminClient().from('admin_mfa_challenges').insert({
			token: mfaToken,
			user_id: user.id,
			ip_address: ipHash,
			user_agent: userAgent,
			expires_at: expiresAt
		});

		await recordAuthAttempt({
			userId: user.id,
			email,
			ipHash,
			userAgent,
			attemptType: 'login',
			success: true
		});

		// Return only the mfaToken needed to continue the MFA challenge.
		// Do NOT return name/email/role before authentication is complete —
		// an attacker with compromised credentials but no TOTP device must not
		// be able to enumerate user PII via the pre-auth response.
		return json({
			mfaRequired: true,
			mfaToken
		});
	}

	// No MFA required — create session directly
	const sessionId = await createAdminSession(user.id, ipHash, userAgent);
	const csrfToken = await generateCsrfToken(sessionId);

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

	// Fire-and-forget — do not block the auth response on Pushover latency.
	// Email omitted: it would be sent to a third-party API as PII.
	void notify('security', {
		title: '🔐 Admin login',
		message: `Successful login (role: ${user.role})`,
		priority: -1
	});

	const headers = new Headers({ 'Content-Type': 'application/json' });
	headers.append('Set-Cookie', buildSessionCookie(sessionId));
	headers.append('Set-Cookie', buildCsrfCookie(csrfToken));

	return new Response(
		JSON.stringify({
			ok: true,
			user: {
				id: user.id,
				email: user.email,
				firstName: user.first_name,
				lastName: user.last_name,
				role: user.role
			}
		}),
		{ status: 200, headers }
	);
};
