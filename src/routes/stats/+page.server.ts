import { supabase } from '$lib/supabase';
import { decodeHtmlEntities } from '$lib/escape';
import type { PageServerLoad } from './$types';
import type { Pothole } from '$lib/types';
import { logError } from '$lib/server/observability';

// Fixture pothole for E2E tests. Coordinates fall inside the polygon used in
// ward-profile.spec.ts (43.40–43.45 lat, -80.55 to -80.50 lng) so ward rows
// render and the link-to-ward-profile test can find an <a href="/stats/ward/…">.
const E2E_STATS_FIXTURE: Pothole[] = [
	{
		id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
		created_at: '2026-01-15T10:00:00.000Z',
		lat: 43.42,
		lng: -80.52,
		address: '100 Test Street, Kitchener, ON',
		description: null,
		status: 'reported',
		confirmed_count: 3,
		filled_at: null,
		expired_at: null,
		photos_published: false
	}
];

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
		return { potholes: url.searchParams.get('__fixture') === '1' ? E2E_STATS_FIXTURE : ([] as Pothole[]) };
	}

	setHeaders({ 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' });

	const { data, error } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, status, filled_at, expired_at, address, confirmed_count')
		.neq('status', 'pending')
		.order('created_at', { ascending: false })
		.limit(5000);

	if (error) {
		logError('stats/load', 'Failed to load stats potholes', error);
		return { potholes: [] as Pothole[] };
	}

	const potholes = (data ?? []).map((p) => ({
		...p,
		address: p.address ? decodeHtmlEntities(p.address) : null
	})) as Pothole[];

	return { potholes };
};
