import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAdminClient } from '$lib/server/supabase';
import { decodeHtmlEntities } from '$lib/escape';
import { logError } from '$lib/server/observability';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');

	const { data, error: dbError } = await getAdminClient()
		.from('potholes')
		.select(
			'id, created_at, lat, lng, address, description, status, confirmed_count, filled_at, expired_at, photos_published',
		)
		.order('created_at', { ascending: false })
		.limit(5000);

	if (dbError) {
		logError('admin/map', 'Failed to load potholes for admin map', dbError);
		throw error(500, 'Failed to load potholes');
	}

	const potholes = (data ?? []).map((p) => ({
		...p,
		address: p.address ? decodeHtmlEntities(p.address) : null,
		description: p.description ? decodeHtmlEntities(p.description) : null,
	}));

	return { potholes, adminRole: locals.adminUser.role };
};
