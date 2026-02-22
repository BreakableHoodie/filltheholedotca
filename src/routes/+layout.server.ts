import { supabase } from '$lib/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	try {
		const { data, error } = await supabase
			.from('potholes')
			.select('status')
			.neq('status', 'pending');

		if (error) {
			console.error('Supabase load error:', error);
			return { counts: { reported: 0, flagged: 0, filled: 0 } };
		}

		const reported = data?.filter((p) => p.status === 'reported').length ?? 0;
		const flagged = data?.filter((p) => p.status === 'wanksyd').length ?? 0;
		const filled = data?.filter((p) => p.status === 'filled').length ?? 0;

		return { counts: { reported, flagged, filled } };
	} catch (e) {
		console.error('Supabase load exception:', e);
		return { counts: { reported: 0, flagged: 0, filled: 0 } };
	}

};
