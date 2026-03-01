import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { checkAuthRateLimit, recordAuthAttempt } from '$lib/server/admin-auth';
import { hashPassword } from '$lib/server/admin-crypto';
import { hashIp } from '$lib/hash';

// Client created inside request handlers — $env/dynamic/private is not
// guaranteed to be populated at module-init time in Vite SSR dev mode.
function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
const MIN_BOOTSTRAP_SECRET_LENGTH = 32;

function getConfiguredBootstrapSecret(): string | null {
	const secret = env.ADMIN_BOOTSTRAP_SECRET?.trim() ?? '';
	if (
		secret.length < MIN_BOOTSTRAP_SECRET_LENGTH ||
		secret.startsWith('placeholder_') ||
		secret === 'changeme'
	) {
		return null;
	}
	return secret;
}

function secureSecretMatch(provided: string, expected: string): boolean {
	const providedLen = Buffer.byteLength(provided, 'utf8');
	const expectedLen = Buffer.byteLength(expected, 'utf8');
	// Pad both buffers to the same length so timingSafeEqual always runs over
	// the same number of bytes, regardless of input length. This prevents a
	// timing oracle that would otherwise let an attacker binary-search the
	// secret's byte count.
	const maxLen = Math.max(providedLen, expectedLen);
	const providedBuffer = Buffer.alloc(maxLen);
	const expectedBuffer = Buffer.alloc(maxLen);
	Buffer.from(provided, 'utf8').copy(providedBuffer);
	Buffer.from(expected, 'utf8').copy(expectedBuffer);
	// timingSafeEqual runs first (always, unconditionally) so content timing is
	// never observable. Only then do we enforce strict length equality — this
	// rejects NUL-padded inputs like `<real secret>\x00` that would otherwise
	// pass the padded comparison alone.
	return timingSafeEqual(providedBuffer, expectedBuffer) && providedLen === expectedLen;
}

async function getAdminUserCount(): Promise<number> {
	const { count } = await getAdminClient().from('admin_users').select('*', { count: 'exact', head: true });
	return count ?? 0;
}

// ---------------------------------------------------------------------------
// Load: either bootstrap first admin (no users yet) or validate invite code
// ---------------------------------------------------------------------------
export const load: PageServerLoad = async ({ url, locals }) => {
	// Logged-in admins shouldn't access signup.
	if (locals.adminUser) throw redirect(302, '/admin/photos');

	const adminUserCount = await getAdminUserCount();
	if (adminUserCount === 0) {
		return {
			bootstrap: true,
			bootstrapConfigured: Boolean(getConfiguredBootstrapSecret()),
			invite: null,
			error: null
		};
	}

	const code = url.searchParams.get('code')?.trim() ?? '';
	if (!code) {
		return {
			bootstrap: false,
			bootstrapConfigured: false,
			invite: null,
			error: 'No invite code provided.'
		};
	}

	const { data: invite } = await getAdminClient()
		.from('admin_invite_codes')
		.select('id, code, email, role, expires_at, is_active, used_at')
		.eq('code', code)
		.maybeSingle();

	const invalid =
		!invite ||
		!invite.is_active ||
		invite.used_at !== null ||
		new Date(invite.expires_at) < new Date();

	if (invalid) {
		return {
			bootstrap: false,
			bootstrapConfigured: false,
			invite: null,
			error: 'This invite link is invalid or has expired.'
		};
	}

	return {
		bootstrap: false,
		bootstrapConfigured: false,
		invite: { code: invite.code, email: invite.email, role: invite.role as string }
	};
};

// ---------------------------------------------------------------------------
// Action: bootstrap first admin (one-time) OR invite-based signup
// ---------------------------------------------------------------------------
export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const fd = await request.formData();
		const code = fd.get('code')?.toString().trim() ?? '';
		const email = fd.get('email')?.toString().trim().toLowerCase() ?? '';
		const firstName = fd.get('firstName')?.toString().trim() ?? '';
		const lastName = fd.get('lastName')?.toString().trim() ?? '';
		const password = fd.get('password')?.toString() ?? '';
		const confirmPassword = fd.get('confirmPassword')?.toString() ?? '';
		const bootstrapSecret = fd.get('bootstrapSecret')?.toString().trim() ?? '';
		const ipHash = await hashIp(getClientAddress());
		const userAgent = request.headers.get('user-agent') ?? 'unknown';

		const adminUserCount = await getAdminUserCount();
		const isBootstrapFlow = adminUserCount === 0;
		const echo = { email, firstName, lastName, code, bootstrap: isBootstrapFlow };

		// Basic field validation
		const fieldsParsed = z
			.object({
				email: z.string().email().max(255),
				firstName: z.string().min(1).max(100),
				lastName: z.string().min(1).max(100),
				password: z
					.string()
					.min(12, 'Password must be at least 12 characters')
					.max(128, 'Password must be at most 128 characters')
					.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
					.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
					.regex(/[0-9]/, 'Password must contain at least one number')
					.regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
			})
			.safeParse({ email, firstName, lastName, password });

		if (!fieldsParsed.success)
			return fail(400, { error: fieldsParsed.error.issues[0]?.message ?? 'Invalid input', ...echo });

		if (password !== confirmPassword)
			return fail(400, { error: 'Passwords do not match', ...echo });

		const rateCheck = await checkAuthRateLimit(email, ipHash, 'signup');
		if (!rateCheck.allowed) {
			return fail(429, {
				error: `Too many signup attempts. Try again in ${rateCheck.remainingMinutes} minutes.`,
				...echo
			});
		}

		// One-time bootstrap flow: only available while admin_users is empty.
		if (isBootstrapFlow) {
			const configuredBootstrapSecret = getConfiguredBootstrapSecret();
			if (!configuredBootstrapSecret) {
				return fail(503, {
					error:
						'Bootstrap is not configured. Set ADMIN_BOOTSTRAP_SECRET to a strong random value and retry.',
					...echo
				});
			}

			if (!secureSecretMatch(bootstrapSecret, configuredBootstrapSecret)) {
				await recordAuthAttempt({
					email,
					ipHash,
					userAgent,
					attemptType: 'signup',
					success: false,
					failureReason: 'invalid_bootstrap_secret'
				});
				return fail(403, { error: 'Invalid bootstrap secret', ...echo });
			}

			const { data: existing } = await getAdminClient()
				.from('admin_users')
				.select('id')
				.eq('email', email)
				.maybeSingle();

			if (existing) return fail(400, { error: 'An account with that email already exists', ...echo });

			const passwordHash = await hashPassword(password);
			const { data: newUser, error: insertError } = await getAdminClient()
				.from('admin_users')
				.insert({
					email,
					password_hash: passwordHash,
					first_name: firstName,
					last_name: lastName,
					role: 'admin',
					is_active: true,
					activated_at: new Date().toISOString()
				})
				.select('id')
				.single();

			if (insertError || !newUser) {
				return fail(500, { error: 'Failed to create bootstrap account. Please try again.', ...echo });
			}

			// Guard against concurrent bootstrap: elect a winner by earliest created_at (id as
			// tiebreaker). Both concurrent requests see the same winner after their inserts commit,
			// so only the loser deletes its own row — the count-then-delete approach would cause
			// both to delete themselves if they both read postCount > 1 before either delete commits.
			const { data: firstAdmin } = await getAdminClient()
				.from('admin_users')
				.select('id')
				.order('created_at', { ascending: true })
				.order('id', { ascending: true })
				.limit(1)
				.single();

			if (!firstAdmin || firstAdmin.id !== newUser.id) {
				await getAdminClient().from('admin_users').delete().eq('id', newUser.id);
				return fail(409, {
					error: 'Another admin account was created simultaneously. Please log in instead.',
					...echo
				});
			}

			await recordAuthAttempt({
				userId: newUser.id,
				email,
				ipHash,
				userAgent,
				attemptType: 'signup',
				success: true
			});

			// Log only the UUID — never log the email address to stdout.
			console.info(`[bootstrap] First admin account created (id: ${newUser.id}).`);
			return { registered: true, requiresActivation: false, role: 'admin' };
		}

		// Re-validate invite (never trust hidden field — re-fetch from DB)
		const { data: invite } = await getAdminClient()
			.from('admin_invite_codes')
			.select('id, email, role, expires_at, is_active, used_at')
			.eq('code', code)
			.maybeSingle();

		const invalid =
			!invite ||
			!invite.is_active ||
			invite.used_at !== null ||
			new Date(invite.expires_at) < new Date();

		if (invalid) {
			await recordAuthAttempt({ email, ipHash, userAgent, attemptType: 'signup', success: false, failureReason: 'invalid_invite_code' });
			return fail(400, { error: 'Invalid or expired invite code', ...echo });
		}

		// If invite is email-restricted, enforce it
		if (invite.email && invite.email.toLowerCase() !== email) {
			await recordAuthAttempt({ email, ipHash, userAgent, attemptType: 'signup', success: false, failureReason: 'invite_email_mismatch' });
			return fail(400, { error: 'Email does not match this invite', ...echo });
		}

		// Check email uniqueness
		const { data: existing } = await getAdminClient()
			.from('admin_users')
			.select('id')
			.eq('email', email)
			.maybeSingle();

		if (existing) {
			await recordAuthAttempt({ email, ipHash, userAgent, attemptType: 'signup', success: false, failureReason: 'email_taken' });
			return fail(400, { error: 'An account with that email already exists', ...echo });
		}

		// Create user — role always from invite, never from request body
		const passwordHash = await hashPassword(password);
		const { data: newUser, error: insertError } = await getAdminClient()
			.from('admin_users')
			.insert({
				email,
				password_hash: passwordHash,
				first_name: firstName,
				last_name: lastName,
				role: invite.role,
				is_active: false // admin must activate before user can log in
			})
			.select('id')
			.single();

		if (insertError || !newUser)
			return fail(500, { error: 'Failed to create account. Please try again.', ...echo });

		// Atomically mark invite as used — the .is('used_at', null) guard ensures only one
		// concurrent signup wins even if two requests arrive with the same valid code.
		const { data: consumed } = await getAdminClient()
			.from('admin_invite_codes')
			.update({ used_by: newUser.id, used_at: new Date().toISOString(), is_active: false })
			.eq('id', invite.id)
			.is('used_at', null)
			.select('id');

		if (!consumed || consumed.length === 0) {
			// Another concurrent request consumed the invite first — roll back the created user.
			await getAdminClient().from('admin_users').delete().eq('id', newUser.id);
			return fail(409, { error: 'This invite code has already been used', ...echo });
		}

		await recordAuthAttempt({
			userId: newUser.id,
			email,
			ipHash,
			userAgent,
			attemptType: 'signup',
			success: true
		});

		return { registered: true, requiresActivation: true, role: invite.role };
	}
};
