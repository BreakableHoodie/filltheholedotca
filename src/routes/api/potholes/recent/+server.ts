import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';
import { decodeHtmlEntities } from '$lib/escape';
import { logError } from '$lib/server/observability';

export const GET: RequestHandler = async ({ url }) => {
	const since = url.searchParams.get('since');
	if (!since || isNaN(Date.parse(since))) {
		return json({ potholes: [] });
	}

	const { data, error: dbError } = await supabase
		.from('potholes')
		.select(
			'id, created_at, lat, lng, address, description, status, confirmed_count, filled_at, expired_at, photos_published',
		)
		.neq('status', 'pending')
		.or(`created_at.gt.${since},filled_at.gt.${since},expired_at.gt.${since}`)
		.order('created_at', { ascending: false })
		.limit(100);

	if (dbError) {
		logError('api/potholes/recent', 'Failed to fetch recent potholes', dbError);
		return json({ potholes: [] });
	}

	const potholes = (data ?? []).map((p) => ({
		...p,
		address: p.address ? decodeHtmlEntities(p.address) : null,
		description: p.description ? decodeHtmlEntities(p.description) : null,
	}));

	return json({ potholes });
};
