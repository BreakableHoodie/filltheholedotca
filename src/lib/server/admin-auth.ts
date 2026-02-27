import { error } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

// Client created per-call — $env/dynamic/private is not guaranteed to be
// populated at module-init time in Vite SSR dev mode.
function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

export type AdminRole = 'admin' | 'editor' | 'viewer';
export const ROLE_LEVELS: Record<AdminRole, number> = { admin: 3, editor: 2, viewer: 1 };

export function requireRole(userRole: AdminRole, required: AdminRole): void {
	if (ROLE_LEVELS[userRole] < ROLE_LEVELS[required]) {
		throw error(403, 'Insufficient permissions');
	}
}

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

export interface AdminUser {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: AdminRole;
	isActive: boolean;
	totpEnabled: boolean;
}

export interface AdminSession {
	id: string;
	userId: string;
	expiresAt: Date;
	createdAt: Date;
	lastActivityAt: Date;
}

// ---------------------------------------------------------------------------
// Session timeouts
// ---------------------------------------------------------------------------

export const SESSION_CONFIG = {
	/** Idle timeout for editor/viewer: 30 minutes */
	idleTimeout: 30 * 60 * 1000,
	/** Absolute timeout for editor/viewer: 8 hours */
	absoluteTimeout: 8 * 60 * 60 * 1000,
	/** Idle timeout for admin role: 15 minutes */
	adminIdleTimeout: 15 * 60 * 1000,
	/** Absolute timeout for admin role: 4 hours */
	adminAbsoluteTimeout: 4 * 60 * 60 * 1000
} as const;

const SESSION_EXPIRY_DAYS = 1; // hard DB expiry — soft timeouts enforced above

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function createAdminSession(
	userId: string,
	// ip_address column stores an HMAC-SHA-256 hash — never a raw IP.
	ipHash: string,
	userAgent: string
): Promise<string> {
	const sessionId = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

	const { error: insertError } = await getAdminClient().from('admin_sessions').insert({
		id: sessionId,
		user_id: userId,
		expires_at: expiresAt.toISOString(),
		ip_address: ipHash,
		user_agent: userAgent
	});

	if (insertError) throw new Error(`Failed to create session: ${insertError.message}`);
	return sessionId;
}

export async function validateAdminSession(
	sessionId: string
): Promise<{ user: AdminUser; session: AdminSession } | null> {
	const { data, error: queryError } = await getAdminClient()
		.from('admin_sessions')
		.select(
			`
      id, user_id, expires_at, created_at, last_activity_at,
      admin_users!inner (
        id, email, first_name, last_name, role, is_active, totp_enabled
      )
    `
		)
		.eq('id', sessionId)
		.gt('expires_at', new Date().toISOString())
		.maybeSingle();

	if (queryError || !data) return null;

	const dbUser = (data as unknown as { admin_users: Record<string, unknown> }).admin_users;
	if (!dbUser || !dbUser['is_active']) return null;

	const user: AdminUser = {
		id: dbUser['id'] as string,
		email: dbUser['email'] as string,
		firstName: dbUser['first_name'] as string,
		lastName: dbUser['last_name'] as string,
		role: dbUser['role'] as AdminRole,
		isActive: dbUser['is_active'] as boolean,
		totpEnabled: dbUser['totp_enabled'] as boolean
	};

	const session: AdminSession = {
		id: data.id as string,
		userId: data.user_id as string,
		expiresAt: new Date(data.expires_at as string),
		createdAt: new Date(data.created_at as string),
		lastActivityAt: new Date(data.last_activity_at as string)
	};

	return { user, session };
}

export async function touchSession(sessionId: string): Promise<void> {
	await getAdminClient()
		.from('admin_sessions')
		.update({ last_activity_at: new Date().toISOString() })
		.eq('id', sessionId);
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await getAdminClient().from('admin_sessions').delete().eq('id', sessionId);
}

export async function invalidateAllSessionsForUser(
	userId: string,
	exceptSessionId?: string
): Promise<void> {
	let query = getAdminClient().from('admin_sessions').delete().eq('user_id', userId);
	if (exceptSessionId) query = query.neq('id', exceptSessionId);
	await query;
}

// ---------------------------------------------------------------------------
// Session timeout enforcement
// Returns the reason if expired, null if still valid.
// ---------------------------------------------------------------------------

export function checkSessionExpiry(
	session: AdminSession,
	userRole: AdminRole
): 'idle' | 'absolute' | null {
	const now = Date.now();
	const idleTimeout =
		userRole === 'admin' ? SESSION_CONFIG.adminIdleTimeout : SESSION_CONFIG.idleTimeout;
	const absoluteTimeout =
		userRole === 'admin' ? SESSION_CONFIG.adminAbsoluteTimeout : SESSION_CONFIG.absoluteTimeout;

	if (now - session.lastActivityAt.getTime() > idleTimeout) return 'idle';
	if (now - session.createdAt.getTime() > absoluteTimeout) return 'absolute';
	return null;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function writeAuditLog(
	userId: string | null,
	action: string,
	resourceType: string | null,
	resourceId: string | null,
	details: object | null,
	// ip_address column stores an HMAC-SHA-256 hash — never a raw IP.
	ipHash: string
): Promise<void> {
	try {
		const { error: auditError } = await getAdminClient().from('admin_audit_log').insert({
			user_id: userId,
			action,
			resource_type: resourceType,
			resource_id: resourceId,
			details: details ?? null,
			ip_address: ipHash
		});
		// Supabase returns errors in the result, not as thrown exceptions.
		if (auditError) console.error('[audit] Failed to write audit log:', auditError.message);
	} catch (e) {
		// Catch network-level failures separately.
		console.error('[audit] Unexpected error writing audit log:', e);
	}
}

// ---------------------------------------------------------------------------
// Login rate limiting (DB-backed)
// ---------------------------------------------------------------------------

export async function checkAuthRateLimit(
	email: string,
	// ipHash must be an HMAC-SHA-256 hash — never a raw IP.
	ipHash: string,
	attemptType: 'login' | 'mfa' | 'signup'
): Promise<{ allowed: boolean; remainingMinutes?: number }> {
	const windowMs = 10 * 60 * 1000; // 10 minutes
	const maxFailures = 5;
	const windowStart = new Date(Date.now() - windowMs).toISOString();

	// Two separate parameterized queries to avoid PostgREST .or() string injection.
	// A crafted email value could alter the filter logic in .or(`email.eq.${email},...`).
	const [emailResult, ipResult] = await Promise.all([
		getAdminClient()
			.from('admin_auth_attempts')
			.select('*', { count: 'exact', head: true })
			.eq('email', email)
			.eq('attempt_type', attemptType)
			.eq('success', false)
			.gte('created_at', windowStart),
		getAdminClient()
			.from('admin_auth_attempts')
			.select('*', { count: 'exact', head: true })
			.eq('ip_address', ipHash)
			.eq('attempt_type', attemptType)
			.eq('success', false)
			.gte('created_at', windowStart)
	]);

	if (emailResult.error || ipResult.error) return { allowed: true }; // fail open on query error

	const count = Math.max(emailResult.count ?? 0, ipResult.count ?? 0);

	if (count >= maxFailures) {
		return { allowed: false, remainingMinutes: Math.ceil(windowMs / 60_000) };
	}

	return { allowed: true };
}

export async function recordAuthAttempt(params: {
	userId?: string | null;
	email: string;
	// ipHash must be an HMAC-SHA-256 hash — never a raw IP.
	ipHash: string;
	userAgent: string;
	attemptType: 'login' | 'mfa' | 'signup';
	success: boolean;
	failureReason?: string;
}): Promise<void> {
	await getAdminClient().from('admin_auth_attempts').insert({
		user_id: params.userId ?? null,
		email: params.email,
		ip_address: params.ipHash,
		user_agent: params.userAgent,
		attempt_type: params.attemptType,
		success: params.success,
		failure_reason: params.failureReason ?? null
	});
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = 'admin_session';
export const TRUSTED_DEVICE_COOKIE = 'admin_trusted_device';

/** Build a secure session cookie string. */
export function buildSessionCookie(sessionId: string, isSecure: boolean): string {
	const parts = [
		`${SESSION_COOKIE}=${sessionId}`,
		'HttpOnly',
		'SameSite=Strict',
		'Path=/'
	];
	if (isSecure) parts.push('Secure');
	// Expires in 1 day (matches hard DB expiry)
	const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
	parts.push(`Expires=${expires}`);
	return parts.join('; ');
}

/** Build a blank session cookie to clear it. */
export function clearSessionCookie(): string {
	return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
