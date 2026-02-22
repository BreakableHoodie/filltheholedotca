import { supabase } from '$lib/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const { data } = await supabase
		.from('potholes')
		.select('status')
		.neq('status', 'pending');

	const reported = data?.filter((p) => p.status === 'reported').length ?? 0;
	const flagged = data?.filter((p) => p.status === 'wanksyd').length ?? 0;
	const filled = data?.filter((p) => p.status === 'filled').length ?? 0;

	return { counts: { reported, flagged, filled } };
};
