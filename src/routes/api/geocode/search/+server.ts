import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { logError } from '$lib/server/observability';

const WR_VIEWBOX = '-80.59,43.32,-80.22,43.53';

const querySchema = z.object({
	q: z.string().min(1).max(255),
	limit: z.coerce.number().int().min(1).max(10).default(5),
});

// Server-side proxy so the identifying User-Agent header can be set
// (browsers cannot set User-Agent — it is a forbidden request header).
export const GET: RequestHandler = async ({ url }) => {
	const parsed = querySchema.safeParse({
		q: url.searchParams.get('q'),
		limit: url.searchParams.get('limit') ?? 5,
	});
	if (!parsed.success) throw error(400, 'Invalid request');

	const params = new URLSearchParams({
		q: parsed.data.q,
		format: 'json',
		limit: String(parsed.data.limit),
		viewbox: WR_VIEWBOX,
		bounded: '1',
	});

	try {
		const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
			headers: {
				'User-Agent': 'fillthehole.ca/1.0 (https://fillthehole.ca)',
				Referer: 'https://fillthehole.ca',
			},
			signal: AbortSignal.timeout(5000),
		});

		if (!res.ok) {
			logError(
				'api/geocode/search',
				'Nominatim search returned non-OK response',
				new Error(`Nominatim upstream ${res.status}`),
				{ status: res.status },
			);
			throw error(502, 'Geocode search failed');
		}

		const data = await res.json();
		return json(data);
	} catch (err) {
		if (isHttpError(err)) throw err;
		logError('api/geocode/search', 'Nominatim request failed', err);
		// Deliberately an honest 503 rather than an empty result set: Nominatim being
		// unreachable is not the same as "no such address", and returning [] would push
		// users to abandon a real report. The report flow still has GPS and pin-drop.
		throw error(503, 'Address search unavailable');
	}
};
