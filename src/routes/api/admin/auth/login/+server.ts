import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
	checkAuthRateLimit,
	recordAuthAttempt,
	createAdminSession,
	TRUSTED_DEVICE_COOKIE,
	buildSessionCookie
} from '$lib/server/admin-auth';
import { verifyPassword } from '$lib/server/admin-crypto';
import { generateCsrfToken, buildCsrfCookie } from '$lib/server/admin-csrf';
import { hashIp } from '$lib/hash';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
	const isSecure = request.url.startsWith('https://');

	// DB-backed rate limit: 5 failures / 10 min per email+IP
	const rateCheck = await checkAuthRateLimit(email, ipHash, 'login');
	if (!rateCheck.allowed) {
		throw error(
			429,
			`Too many failed login attempts. Try again in ${rateCheck.remainingMinutes} minutes.`
		);
	}

	// Look up user
	const { data: user } = await adminSupabase
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

	// Check for trusted device before requiring MFA
	let skipMfa = false;
	if (user.totp_enabled) {
		const trustedToken = cookies.get(TRUSTED_DEVICE_COOKIE);
		if (trustedToken) {
			const { data: device } = await adminSupabase
				.from('admin_trusted_devices')
				.select('user_id')
				.eq('token', trustedToken)
				.eq('user_id', user.id)
				.gt('expires_at', new Date().toISOString())
				.maybeSingle();
			if (device) {
				skipMfa = true;
				// Update last_used_at
				await adminSupabase
					.from('admin_trusted_devices')
					.update({ last_used_at: new Date().toISOString() })
					.eq('token', trustedToken);
			}
		}
	}

	if (user.totp_enabled && !skipMfa) {
		// Issue MFA challenge — client must complete /api/admin/auth/mfa/verify
		const mfaToken = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

		// Clean up expired/used challenges for this user
		await adminSupabase
			.from('admin_mfa_challenges')
			.delete()
			.eq('user_id', user.id)
			.or('used.eq.true,expires_at.lt.' + new Date().toISOString());

		await adminSupabase.from('admin_mfa_challenges').insert({
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

		return json({
			mfaRequired: true,
			mfaToken,
			user: { email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role }
		});
	}

	// No MFA required — create session directly
	const sessionId = await createAdminSession(user.id, ipHash, userAgent);
	const csrfToken = await generateCsrfToken(sessionId);

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

	const headers = new Headers({ 'Content-Type': 'application/json' });
	headers.append('Set-Cookie', buildSessionCookie(sessionId, isSecure));
	headers.append('Set-Cookie', buildCsrfCookie(csrfToken, isSecure));

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
