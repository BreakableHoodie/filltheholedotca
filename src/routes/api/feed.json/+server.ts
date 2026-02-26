import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { decodeHtmlEntities } from '$lib/escape';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

export const GET: RequestHandler = async () => {
	// M2: Removed wanksy_at (internal legacy field not for public consumption).
	// M7: Capped at 500 records to prevent unbounded response growth.
	const { data, error } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, address, description, status, filled_at')
		.neq('status', 'pending')
		.order('created_at', { ascending: false })
		.limit(500);

	if (error) return json({ error: 'Failed to load' }, { status: 500 });

	const potholes = (data ?? []).map((p) => ({
		...p,
		address: p.address ? decodeHtmlEntities(p.address) : null,
		description: p.description ? decodeHtmlEntities(p.description) : null
	}));

	return json(
		{
			generated: new Date().toISOString(),
			source: 'fillthehole.ca',
			potholes
		},
		{
			headers: {
				'Cache-Control': 'public, max-age=60',
				'Access-Control-Allow-Origin': '*'
			}
		}
	);
};
