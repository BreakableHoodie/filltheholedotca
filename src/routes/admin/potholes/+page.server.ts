import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import type { PotholeStatus } from '$lib/types';
import { requireRole } from '$lib/server/admin-auth';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const VALID_STATUSES: PotholeStatus[] = ['pending', 'reported', 'filled', 'expired'];

export const load: PageServerLoad = async ({ url, locals }) => {
	// Hooks guarantee a valid session; requireRole makes the permission explicit.
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'viewer');

	const statusParam = url.searchParams.get('status');
	const filterStatus = VALID_STATUSES.includes(statusParam as PotholeStatus)
		? (statusParam as PotholeStatus)
		: null;

	let query = adminSupabase
		.from('potholes')
		.select('id, created_at, address, status, confirmed_count, lat, lng, filled_at, expired_at')
		.order('created_at', { ascending: false })
		.limit(500);

	if (filterStatus) {
		query = query.eq('status', filterStatus);
	}

	const { data, error: dbErr } = await query;
	if (dbErr) throw error(500, 'Failed to load potholes');

	return {
		potholes: data ?? [],
		filterStatus
	};
};
