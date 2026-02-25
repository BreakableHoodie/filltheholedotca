import { supabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';
import type { Pothole } from '$lib/types';
import { decodeHtmlEntities } from '$lib/escape';

export const load: PageServerLoad = async () => {
	try {
		const { data, error } = await supabase
			.from('potholes')
			.select('id, created_at, lat, lng, address, description, status, confirmed_count, filled_at, expired_at')
			.neq('status', 'pending')
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Failed to load potholes:', error);
			return { potholes: [] as Pothole[] };
		}

		const potholes = (data ?? []).map((p) => ({
			...p,
			address: p.address ? decodeHtmlEntities(p.address) : null,
			description: p.description ? decodeHtmlEntities(p.description) : null
		})) as Pothole[];
		return { potholes };
	} catch (e) {
		console.error('Supabase load exception:', e);
		return { potholes: [] as Pothole[] };
	}
};
