import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

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

	// L3: Audit log contains user emails and IPs (hashed) — restrict to editor+.
	// Viewers see the dashboard counts but not the audit trail.
	const canViewAudit = locals.adminUser.role !== 'viewer';

	const [
		pendingPhotosRes,
		pendingPotholesRes,
		reportedPotholesRes,
		filledPotholesRes,
		expiredPotholesRes,
		recentAuditRes
	] = await Promise.all([
		getAdminClient()
			.from('pothole_photos')
			.select('*', { count: 'exact', head: true })
			.eq('moderation_status', 'pending'),

		getAdminClient()
			.from('potholes')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'pending'),

		getAdminClient()
			.from('potholes')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'reported'),

		getAdminClient()
			.from('potholes')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'filled'),

		getAdminClient()
			.from('potholes')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'expired'),

		canViewAudit
			? getAdminClient()
					.from('admin_audit_log')
					.select(
						'id, action, resource_type, resource_id, created_at, admin_users(first_name, last_name, email)'
					)
					.order('created_at', { ascending: false })
					.limit(8)
			: Promise.resolve({ data: null })
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
