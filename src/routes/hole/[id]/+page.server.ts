import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Pothole } from '$lib/types';
import { lookupWard } from '$lib/wards';

export const load: PageServerLoad = async ({ params, url }) => {
	const { data, error: dbError } = await supabase
		.from('potholes')
		.select('*')
		.eq('id', params.id)
		.single();

	if (dbError || !data) {
		throw error(404, 'Hole not found');
	}

	const pothole = data as Pothole;
	const councillor = await lookupWard(pothole.lat, pothole.lng);

	return { pothole, councillor, origin: url.origin };
};
