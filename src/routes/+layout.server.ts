import { supabase } from '$lib/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
		return { counts: { reported: 0, filled: 0 } };
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

		if (reportedResult.error) console.error('Supabase load error (reported count):', reportedResult.error);
		if (filledResult.error) console.error('Supabase load error (filled count):', filledResult.error);

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
