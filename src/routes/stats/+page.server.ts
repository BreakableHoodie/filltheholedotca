import { supabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';
import type { Pothole } from '$lib/types';

export const load: PageServerLoad = async () => {
	const { data, error } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, status, filled_at, expired_at')
		.neq('status', 'pending')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Failed to load stats potholes:', error);
		return { potholes: [] as Pothole[] };
	}

	return { potholes: (data ?? []) as Pothole[] };
};
