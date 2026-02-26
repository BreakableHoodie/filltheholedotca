import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { invalidateSession, SESSION_COOKIE } from '$lib/server/admin-auth';
import { CSRF_COOKIE } from '$lib/server/admin-csrf';

export const actions: Actions = {
	default: async ({ cookies, locals }) => {
		const sessionId = cookies.get(SESSION_COOKIE);
		if (sessionId) {
			await invalidateSession(sessionId);
		}
		cookies.set(SESSION_COOKIE, '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'strict' });
		cookies.set(CSRF_COOKIE, '', { path: '/', expires: new Date(0), httpOnly: false, sameSite: 'strict' });
		throw redirect(302, '/admin/login');
	}
};
