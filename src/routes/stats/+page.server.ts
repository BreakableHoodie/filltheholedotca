import { supabase } from '$lib/supabase';
import { decodeHtmlEntities } from '$lib/escape';
import type { PageServerLoad } from './$types';
import type { Pothole } from '$lib/types';
import { COUNCILLORS } from '$lib/wards';
import { lookupWard, fetchWards } from '$lib/server/wards';
import { logError } from '$lib/server/observability';
import { getFreezeThawByMonth } from '$lib/server/weather';

// Stable ward definitions derived from the councillors list — no network call needed.
export type WardDef = {
	city: string; ward: number; key: string;
	councillorName: string; councillorUrl: string;
};

const ALL_WARDS: WardDef[] = COUNCILLORS.map(c => ({
	city: c.city, ward: c.ward, key: `${c.city}-${c.ward}`,
	councillorName: c.name, councillorUrl: c.url
}));

// Fixture pothole for E2E tests. Coordinates fall inside Kitchener Ward 6;
// ward_key is hardcoded so tests don't hit real ArcGIS endpoints.
const E2E_STATS_FIXTURE: Array<Pothole & { ward_key: string | null }> = [
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
		photos_published: false,
		ward_key: 'kitchener-6'
	}
];

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
		const fixture = url.searchParams.get('__fixture') === '1' ? E2E_STATS_FIXTURE : [];
		return { potholes: fixture, wards: ALL_WARDS, freezeThawByMonth: {} as Record<string, number> };
	}

	setHeaders({ 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' });

	// Fetch potholes and pre-warm the ward boundary cache in parallel.
	// fetchWards() now never rejects (errors are caught and cached as []) so
	// Promise.all is safe here, but ward failures must not break the pothole query.
	// getFreezeThawByMonth never rejects (it returns an all-zero map on failure),
	// so it's safe inside Promise.all — a weather hiccup can't break the stats page.
	const [{ data, error }, freezeThawByMonth] = await Promise.all([
		supabase
			.from('potholes')
			.select('id, created_at, lat, lng, status, filled_at, expired_at, address, confirmed_count')
			.neq('status', 'pending')
			.order('created_at', { ascending: false }),
		getFreezeThawByMonth(18),
		fetchWards('kitchener'),
		fetchWards('waterloo'),
		fetchWards('cambridge')
	]);

	if (error) {
		logError('stats/load', 'Failed to load stats potholes', error);
		return {
			potholes: [] as Array<Pothole & { ward_key: string | null }>,
			wards: ALL_WARDS,
			freezeThawByMonth
		};
	}

	const potholes = (data ?? []).map((p) => ({
		...p,
		address: p.address ? decodeHtmlEntities(p.address) : null
	})) as Pothole[];

	// Assign ward keys for all potholes in parallel.
	// Ward boundary data is now cached, so each call is synchronous PIP only.
	const councillors = await Promise.all(potholes.map((p) => lookupWard(p.lat, p.lng)));
	const potholesWithWards = potholes.map((p, i) => ({
		...p,
		ward_key: councillors[i] ? `${councillors[i]!.city}-${councillors[i]!.ward}` : null
	}));

	return { potholes: potholesWithWards, wards: ALL_WARDS, freezeThawByMonth };
};
