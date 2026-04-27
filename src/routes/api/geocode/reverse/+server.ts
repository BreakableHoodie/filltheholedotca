import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

const coordSchema = z.object({
	lat: z.coerce.number().min(43.32).max(43.53),
	lon: z.coerce.number().min(-80.59).max(-80.22)
});

// Server-side proxy so the identifying User-Agent header can be set
// (browsers cannot set User-Agent — it is a forbidden request header).
export const GET: RequestHandler = async ({ url }) => {
	const parsed = coordSchema.safeParse({
		lat: url.searchParams.get('lat'),
		lon: url.searchParams.get('lon')
	});
	if (!parsed.success) throw error(400, 'Invalid coordinates');

	const params = new URLSearchParams({
		lat: String(parsed.data.lat),
		lon: String(parsed.data.lon),
		format: 'json'
	});

	const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
		headers: {
			'User-Agent': 'fillthehole.ca/1.0 (https://fillthehole.ca)',
			Referer: 'https://fillthehole.ca'
		}
	});

	if (!res.ok) throw error(502, 'Reverse geocode failed');

	const data = await res.json();
	return json(data);
};
