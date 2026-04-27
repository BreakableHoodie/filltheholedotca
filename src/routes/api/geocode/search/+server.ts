import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

const WR_VIEWBOX = '-80.59,43.32,-80.22,43.53';

const querySchema = z.object({
	q: z.string().min(1).max(255),
	limit: z.coerce.number().int().min(1).max(10).default(5)
});

// Server-side proxy so the identifying User-Agent header can be set
// (browsers cannot set User-Agent — it is a forbidden request header).
export const GET: RequestHandler = async ({ url }) => {
	const parsed = querySchema.safeParse({
		q: url.searchParams.get('q'),
		limit: url.searchParams.get('limit') ?? 5
	});
	if (!parsed.success) throw error(400, 'Invalid request');

	const params = new URLSearchParams({
		q: parsed.data.q,
		format: 'json',
		limit: String(parsed.data.limit),
		viewbox: WR_VIEWBOX,
		bounded: '1'
	});

	const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
		headers: {
			'User-Agent': 'fillthehole.ca/1.0 (https://fillthehole.ca)',
			Referer: 'https://fillthehole.ca'
		}
	});

	if (!res.ok) throw error(502, 'Geocode search failed');

	const data = await res.json();
	return json(data);
};
