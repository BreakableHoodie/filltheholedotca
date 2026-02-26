import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type RecentEntry = {
	id: string;
	action: string;
	resource_type: string | null;
	resource_id: string | null;
	created_at: string;
	admin_users: { first_name: string; last_name: string; email: string } | null;
};

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');

	const [
		pendingPhotosRes,
		pendingPotholesRes,
		reportedPotholesRes,
		filledPotholesRes,
		expiredPotholesRes,
		recentAuditRes
	] = await Promise.all([
		adminSupabase
			.from('pothole_photos')
			.select('*', { count: 'exact', head: true })
			.eq('moderation_status', 'pending'),

		adminSupabase
			.from('potholes')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'pending'),

		adminSupabase
			.from('potholes')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'reported'),

		adminSupabase
			.from('potholes')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'filled'),

		adminSupabase
			.from('potholes')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'expired'),

		adminSupabase
			.from('admin_audit_log')
			.select(
				'id, action, resource_type, resource_id, created_at, admin_users(first_name, last_name, email)'
			)
			.order('created_at', { ascending: false })
			.limit(8)
	]);

	return {
		counts: {
			pendingPhotos: pendingPhotosRes.count ?? 0,
			pendingPotholes: pendingPotholesRes.count ?? 0,
			reportedPotholes: reportedPotholesRes.count ?? 0,
			filledPotholes: filledPotholesRes.count ?? 0,
			expiredPotholes: expiredPotholesRes.count ?? 0
		},
		recentAudit: (recentAuditRes.data ?? []) as unknown as RecentEntry[]
	};
};
