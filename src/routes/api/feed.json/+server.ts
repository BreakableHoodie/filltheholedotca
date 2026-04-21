import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { decodeHtmlEntities } from '$lib/escape';
import { roundPublicCoord } from '$lib/geo';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

export const GET: RequestHandler = async ({ request }) => {
	// M2: Removed wanksy_at (internal legacy field not for public consumption).
	// M7: Capped at 500 records to prevent unbounded response growth.
	const { data, error } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, address, description, status, filled_at')
		.neq('status', 'pending')
		.order('created_at', { ascending: false })
		.limit(500);

	if (error)
		return json(
			{ error: 'Failed to load' },
			{ status: 500, headers: { 'Cross-Origin-Resource-Policy': 'cross-origin' } }
		);

	const potholes = (data ?? []).map((p) => ({
		...p,
		lat: roundPublicCoord(p.lat),
		lng: roundPublicCoord(p.lng),
		address: p.address ? decodeHtmlEntities(p.address) : null,
		description: p.description ? decodeHtmlEntities(p.description) : null
	}));

	// Compute Last-Modified from the most-recent event in this response.
	const lastModifiedMs = potholes.reduce((max, p) => {
		const t = Math.max(
			new Date(p.created_at).getTime(),
			p.filled_at ? new Date(p.filled_at).getTime() : 0
		);
		return t > max ? t : max;
	}, 0);
	const lastModified = new Date(lastModifiedMs || Date.now()).toUTCString();

	// 304 Not Modified: skip sending the body if the CDN/client has current data.
	const ifModifiedSince = request.headers.get('if-modified-since');
	if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(lastModified)) {
		return new Response(null, {
			status: 304,
			headers: {
				'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
				'Last-Modified': lastModified,
				'Access-Control-Allow-Origin': '*'
			}
		});
	}

	return json(
		{
			generated: new Date().toISOString(),
			source: 'fillthehole.ca',
			potholes
		},
		{
			headers: {
				'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
				'Last-Modified': lastModified,
				'Access-Control-Allow-Origin': '*',
				// L8: This feed is intentionally public/cross-origin (CORS * above).
				// Opt out of the same-site default set in hooks.server.ts.
				'Cross-Origin-Resource-Policy': 'cross-origin'
			}
		}
	);
};
