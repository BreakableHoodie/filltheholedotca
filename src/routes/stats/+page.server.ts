import { supabase } from '$lib/supabase';
import { decodeHtmlEntities } from '$lib/escape';
import type { PageServerLoad } from './$types';
import type { Pothole } from '$lib/types';

export const load: PageServerLoad = async () => {
	const { data, error } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, status, filled_at, expired_at, address, confirmed_count')
		.neq('status', 'pending')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Failed to load stats potholes:', error);
		return { potholes: [] as Pothole[] };
	}

	const potholes = (data ?? []).map((p) => ({
		...p,
		address: p.address ? decodeHtmlEntities(p.address) : null
	})) as Pothole[];

	return { potholes };
};
