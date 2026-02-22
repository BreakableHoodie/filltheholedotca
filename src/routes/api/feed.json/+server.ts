import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

export const GET: RequestHandler = async () => {
	const { data, error } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, address, description, status, wanksy_at, filled_at')
		.neq('status', 'pending')
		.order('created_at', { ascending: false });

	if (error) return json({ error: 'Failed to load' }, { status: 500 });

	return json(
		{
			generated: new Date().toISOString(),
			source: 'fillthehole.ca',
			potholes: data ?? []
		},
		{
			headers: {
				'Cache-Control': 'public, max-age=60',
				'Access-Control-Allow-Origin': '*'
			}
		}
	);
};
