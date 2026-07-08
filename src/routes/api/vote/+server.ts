import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { hashIp } from '$lib/hash';
import { logError } from '$lib/server/observability';
import { getAdminClient } from '$lib/server/supabase';

const postSchema = z.object({
	id: z.string().uuid(),
	direction: z.union([z.literal(1), z.literal(-1)]),
});

const deleteSchema = z.object({
	id: z.string().uuid(),
});

const VOTE_RATE_LIMIT = 20;
const VOTE_RATE_WINDOW_MS = 60 * 60 * 1000;
const VOTE_PER_POTHOLE_LIMIT = 50;

function computeScore(rows: { vote_direction: number }[]): {
	netScore: number;
	upvotes: number;
	downvotes: number;
} {
	let netScore = 0;
	let upvotes = 0;
	let downvotes = 0;
	for (const r of rows) {
		netScore += r.vote_direction;
		if (r.vote_direction === 1) upvotes++;
		else downvotes++;
	}
	return { netScore, upvotes, downvotes };
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = postSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const ipHash = await hashIp(getClientAddress());
	const db = getAdminClient();
	const windowStart = new Date(Date.now() - VOTE_RATE_WINDOW_MS).toISOString();

	// Per-IP rate limit
	const { count: recentVotes, error: rateLimitError } = await db
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'vote_submit')
		.gte('created_at', windowStart);

	if (rateLimitError) throw error(500, 'Failed to check rate limit');
	if ((recentVotes ?? 0) >= VOTE_RATE_LIMIT) {
		throw error(429, 'Too many requests. Please wait before trying again.');
	}

	// Per-pothole rate limit
	const { count: potholeVotes, error: potholeRateError } = await db
		.from('pothole_votes')
		.select('*', { count: 'exact', head: true })
		.eq('pothole_id', parsed.data.id)
		.gte('created_at', windowStart);

	if (potholeRateError) throw error(500, 'Failed to check rate limit');
	if ((potholeVotes ?? 0) >= VOTE_PER_POTHOLE_LIMIT) {
		throw error(429, 'Too many requests. Please wait before trying again.');
	}

	// Upsert vote — on conflict (same IP, same pothole) update direction
	const { error: upsertError } = await db
		.from('pothole_votes')
		.upsert(
			{ pothole_id: parsed.data.id, ip_hash: ipHash, vote_direction: parsed.data.direction },
			{ onConflict: 'pothole_id, ip_hash', ignoreDuplicates: false },
		);

	if (upsertError) {
		logError('vote/upsert', 'Failed to upsert vote', upsertError);
		throw error(500, 'Failed to record vote');
	}

	// Non-fatal rate limit event
	const { error: rateLimitInsertError } = await db
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'vote_submit' });
	if (rateLimitInsertError) {
		logError('vote/ratelimit', 'Failed to record rate limit event', rateLimitInsertError);
	}

	// Return current counts
	const { data: voteRows, error: fetchError } = await db
		.from('pothole_votes')
		.select('vote_direction')
		.eq('pothole_id', parsed.data.id);

	if (fetchError) throw error(500, 'Failed to fetch vote counts');

	return json({ ok: true, ...computeScore(voteRows ?? []) });
};

export const DELETE: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = deleteSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const ipHash = await hashIp(getClientAddress());
	const db = getAdminClient();

	const { error: deleteError } = await db
		.from('pothole_votes')
		.delete()
		.eq('pothole_id', parsed.data.id)
		.eq('ip_hash', ipHash);

	if (deleteError) {
		logError('vote/delete', 'Failed to delete vote', deleteError);
		throw error(500, 'Failed to remove vote');
	}

	// Return updated counts
	const { data: voteRows, error: fetchError } = await db
		.from('pothole_votes')
		.select('vote_direction')
		.eq('pothole_id', parsed.data.id);

	if (fetchError) throw error(500, 'Failed to fetch vote counts');

	return json({ ok: true, ...computeScore(voteRows ?? []) });
};
