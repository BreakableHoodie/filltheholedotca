import { supabase } from '$lib/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ setHeaders }) => {
	// Cache nav counts at the CDN for 60 s; serve stale for up to 5 min while
	// revalidating in the background so repeat visitors never wait for this query.
	setHeaders({ 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' });

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

		return {
			counts: {
				reported: reportedResult.count ?? 0,
				filled: filledResult.count ?? 0
			}
		};
	} catch (e) {
		console.error('Supabase load exception:', e);
		return { counts: { reported: 0, filled: 0 } };
	}
};
