import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { hashIp } from '$lib/hash';
import { logError } from '$lib/server/observability';
import { getAdminClient } from '$lib/server/supabase';
const schema = z.object({ id: z.string().uuid() });

const HIT_RATE_LIMIT = 20;
const HIT_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const HIT_PER_POTHOLE_LIMIT = 50; // max hits any single pothole may receive per hour (cross-IP)

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = schema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const ipHash = await hashIp(getClientAddress());
	const db = getAdminClient();

	// Persistent per-IP rate limit — prevents spraying hits across all potholes.
	const windowStart = new Date(Date.now() - HIT_RATE_WINDOW_MS).toISOString();
	const { count: recentHits, error: rateLimitError } = await db
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'hit_submit')
		.gte('created_at', windowStart);

	if (rateLimitError) throw error(500, 'Failed to check rate limit');
	if ((recentHits ?? 0) >= HIT_RATE_LIMIT) {
		throw error(429, 'Too many requests. Please wait before trying again.');
	}

	// Per-pothole rate limit — prevents distributed bots from inflating a single
	// pothole's hit count across many IPs within the per-IP ceiling.
	const { count: potholeHits, error: potholeRateLimitError } = await db
		.from('pothole_hits')
		.select('*', { count: 'exact', head: true })
		.eq('pothole_id', parsed.data.id)
		.gte('created_at', windowStart);
	if (potholeRateLimitError) throw error(500, 'Failed to check rate limit');
	if ((potholeHits ?? 0) >= HIT_PER_POTHOLE_LIMIT) {
		throw error(429, 'Too many requests. Please wait before trying again.');
	}

	const { error: insertError } = await db
		.from('pothole_hits')
		.insert({ pothole_id: parsed.data.id, ip_hash: ipHash });

	if (insertError) {
		if (insertError.code === '23505') {
			// Already recorded — return current count without error
			const { count } = await db
				.from('pothole_hits')
				.select('*', { count: 'exact', head: true })
				.eq('pothole_id', parsed.data.id);
			return json({ ok: false, message: 'Already recorded.', count: count ?? 0 });
		}
		throw error(500, 'Failed to record hit');
	}

	// Non-fatal rate limit event record
	const { error: rateLimitInsertError } = await db
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'hit_submit' });
	if (rateLimitInsertError) {
		logError('hit/ratelimit', 'Failed to record rate limit event', rateLimitInsertError);
	}

	const { count } = await db
		.from('pothole_hits')
		.select('*', { count: 'exact', head: true })
		.eq('pothole_id', parsed.data.id);

	return json({ ok: true, count: count ?? 0 });
};
