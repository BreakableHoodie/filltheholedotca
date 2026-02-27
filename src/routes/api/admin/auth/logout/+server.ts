import type { RequestHandler } from './$types';
import {
	invalidateSession,
	SESSION_COOKIE,
	clearSessionCookie
} from '$lib/server/admin-auth';
import { clearCsrfCookie } from '$lib/server/admin-csrf';

// Logout is a POST to prevent CSRF-based forced logout via GET.
// No CSRF check here — the act of logging out is low-risk and the user
// may have an invalid/missing CSRF token if they navigated directly.
export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get(SESSION_COOKIE);

	if (sessionId) {
		await invalidateSession(sessionId);
	}

	const headers = new Headers({ 'Content-Type': 'application/json' });
	headers.append('Set-Cookie', clearSessionCookie());
	headers.append('Set-Cookie', clearCsrfCookie());

	return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
