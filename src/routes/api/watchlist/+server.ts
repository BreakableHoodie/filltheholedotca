import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

/**
 * GET /api/watchlist?ids=uuid1,uuid2,...
 *
 * Returns current status for up to 50 potholes by ID.
 * IDs are validated as UUIDs before touching the database.
 * Only public fields are returned — no internal metadata.
 */

const querySchema = z.object({
	ids: z
		.string({ message: 'ids is required' })
		.transform((s) =>
			s
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean)
		)
		.pipe(
			z
				.array(z.string().uuid('Each id must be a valid UUID'))
				.min(1, 'Provide at least one id')
				.max(50, 'Maximum 50 ids per request')
		)
});

export const GET: RequestHandler = async ({ url }) => {
	const parsed = querySchema.safeParse({ ids: url.searchParams.get('ids') });
	if (!parsed.success) {
		throw error(400, 'Invalid request: provide 1–50 comma-separated UUIDs in ?ids=');
	}

	const { data: potholes, error: dbError } = await supabase
		.from('potholes')
		.select('id, address, lat, lng, status, created_at, filled_at')
		.in('id', parsed.data.ids);

	if (dbError) throw error(500, 'Database error');

	return json(potholes ?? [], {
		headers: {
			// Short cache — statuses change; but allow brief CDN caching to reduce load
			'Cache-Control': 'private, max-age=30'
		}
	});
};
