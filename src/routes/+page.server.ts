import { supabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';
import type { Pothole } from '$lib/types';
import { decodeHtmlEntities } from '$lib/escape';
import { logError } from '$lib/server/observability';

// Cap root-page payload to keep SSR memory and transfer size bounded as the
// dataset grows. Tune with production telemetry if map coverage needs change.
const MAX_POTHOLES_ON_HOME_PAGE = 2000;

export const load: PageServerLoad = async ({ setHeaders }) => {
	// CDN caches the home page for 60 s and serves stale while revalidating for
	// 5 min — repeat visitors get instant HTML without waiting for a DB query.
	setHeaders({ 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' });

	if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
		return { potholes: [] as Pothole[] };
	}

	try {
		const { data, error } = await supabase
			.from('potholes')
			.select('id, created_at, lat, lng, address, description, status, confirmed_count, filled_at, expired_at, photos_published')
			.neq('status', 'pending')
			.order('created_at', { ascending: false })
			.limit(MAX_POTHOLES_ON_HOME_PAGE);

		if (error) {
			logError('home/load', 'Failed to load potholes', error);
			return { potholes: [] as Pothole[] };
		}

		const potholes = (data ?? []).map((p) => ({
			...p,
			address: p.address ? decodeHtmlEntities(p.address) : null,
			description: p.description ? decodeHtmlEntities(p.description) : null
		})) as Pothole[];
		return { potholes };
	} catch (e) {
		logError('home/load', 'Unexpected exception loading potholes', e);
		return { potholes: [] as Pothole[] };
	}
};
