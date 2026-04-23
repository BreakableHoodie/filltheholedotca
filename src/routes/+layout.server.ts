import { supabase } from '$lib/supabase';
import { logError } from '$lib/server/observability';
import type { LayoutServerLoad } from './$types';

type Counts = { reported: number; filled: number };

let cachedCounts: Counts | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export const load: LayoutServerLoad = async () => {
	if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
		return { counts: { reported: 0, filled: 0 } };
	}

	const now = Date.now();
	if (cachedCounts && now - cacheTimestamp < CACHE_TTL_MS) {
		return { counts: cachedCounts };
	}

	try {
		// Two lightweight COUNT queries in parallel — avoids fetching every row
		// just to count statuses (the previous approach transferred the full table).
		const [reportedResult, filledResult] = await Promise.all([
			supabase
				.from('potholes')
				.select('*', { count: 'exact', head: true })
				.eq('status', 'reported'),
			supabase
				.from('potholes')
				.select('*', { count: 'exact', head: true })
				.eq('status', 'filled')
		]);

		if (reportedResult.error) logError('layout', 'Supabase load error (reported count)', reportedResult.error);
		if (filledResult.error) logError('layout', 'Supabase load error (filled count)', filledResult.error);

		const counts: Counts = {
			reported: reportedResult.count ?? 0,
			filled: filledResult.count ?? 0
		};
		cachedCounts = counts;
		cacheTimestamp = now;
		return { counts };
	} catch (e) {
		logError('layout', 'Supabase load exception', e instanceof Error ? e : new Error(String(e)));
		return { counts: cachedCounts ?? { reported: 0, filled: 0 } };
	}
};
