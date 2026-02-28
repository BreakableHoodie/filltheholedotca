import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const PAGE_SIZE = 50;

export type AuditEntry = {
	id: string;
	action: string;
	resource_type: string | null;
	resource_id: string | null;
	details: Record<string, unknown> | null;
	ip_address: string | null;
	created_at: string;
	admin_users: {
		id: string;
		email: string;
		first_name: string;
		last_name: string;
		role: string;
	} | null;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	// Validate filterUser as UUID to prevent injection via .eq()
	const rawUser = url.searchParams.get('user');
	const filterUser = rawUser && z.string().uuid().safeParse(rawUser).success ? rawUser : null;
	const filterResourceType = url.searchParams.get('resource_type') || null;
	const filterAction = url.searchParams.get('action') || null;

	const offset = (page - 1) * PAGE_SIZE;

	let query = getAdminClient()
		.from('admin_audit_log')
		.select(
			'id, action, resource_type, resource_id, details, ip_address, created_at, admin_users(id, email, first_name, last_name, role)',
			{ count: 'exact' }
		)
		.order('created_at', { ascending: false })
		.range(offset, offset + PAGE_SIZE - 1);

	if (filterUser) query = query.eq('user_id', filterUser);
	if (filterResourceType) query = query.eq('resource_type', filterResourceType);
	if (filterAction) query = query.ilike('action', `%${filterAction}%`);

	const [{ data: entries, count, error: dbErr }, { data: users }] = await Promise.all([
		query,
		getAdminClient().from('admin_users').select('id, email, first_name, last_name').order('email')
	]);

	if (dbErr) throw error(500, 'Failed to load audit log');

	const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

	// Build base params for pagination URLs (preserve active filters)
	const baseParams = new URLSearchParams();
	if (filterUser) baseParams.set('user', filterUser);
	if (filterResourceType) baseParams.set('resource_type', filterResourceType);
	if (filterAction) baseParams.set('action', filterAction);

	function pageUrl(p: number): string {
		const params = new URLSearchParams(baseParams);
		if (p > 1) params.set('page', String(p));
		const s = params.toString();
		return `/admin/audit${s ? '?' + s : ''}`;
	}

	return {
		entries: (entries ?? []) as unknown as AuditEntry[],
		users: users ?? [],
		page,
		totalPages,
		totalCount: count ?? 0,
		filterUser,
		filterResourceType,
		filterAction,
		prevUrl: page > 1 ? pageUrl(page - 1) : null,
		nextUrl: page < totalPages ? pageUrl(page + 1) : null,
		firstEntry: offset + 1,
		lastEntry: Math.min(offset + PAGE_SIZE, count ?? 0)
	};
};
