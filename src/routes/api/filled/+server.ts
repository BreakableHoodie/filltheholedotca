import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { hashIp } from '$lib/hash';

// Public anon client — used only for pothole_actions (rate-limit/dedup).
// The actual pothole UPDATE uses the service-role client so no public UPDATE
// RLS policy is needed on the potholes table.
const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
function getServiceClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const schema = z.object({ id: z.string().uuid() });

// Persistent per-IP fill rate limit: max 10 per hour.
// Uses the pothole_actions table so the limit survives serverless cold starts.
const FILL_RATE_LIMIT = 10;
const FILL_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = schema.safeParse(raw);

	if (!parsed.success) throw error(400, 'Invalid request');

	const ipHash = await hashIp(getClientAddress());

	// Persistent rate limit — query the DB so this survives cold starts
	const windowStart = new Date(Date.now() - FILL_RATE_WINDOW_MS).toISOString();
	const { count: recentFills, error: countError } = await supabase
		.from('pothole_actions')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('action', 'filled')
		.gte('created_at', windowStart);

	if (countError) throw error(500, 'Rate limit check failed');
	if ((recentFills ?? 0) >= FILL_RATE_LIMIT) {
		throw error(429, 'Too many fill reports. Please slow down.');
	}

	// Record this action — unique constraint (pothole_id, ip_hash, action) prevents
	// the same device from triggering the same transition more than once
	const { error: actionError } = await supabase
		.from('pothole_actions')
		.insert({ pothole_id: parsed.data.id, ip_hash: ipHash, action: 'filled' });

	if (actionError) {
		if (actionError.code === '23505') {
			return json({ ok: false, message: "You've already marked this one as filled." });
		}
		throw error(500, 'Failed to record action');
	}

	// Use service-role key for the update — no public UPDATE policy exists on potholes.
	const { data: updated, error: updateError } = await getServiceClient()
		.from('potholes')
		.update({ status: 'filled', filled_at: new Date().toISOString() })
		.eq('id', parsed.data.id)
		.neq('status', 'pending')
		.neq('status', 'filled')
		.neq('status', 'expired')
		.select('id');

	if (updateError) throw error(500, 'Failed to update status');
	if (!updated || updated.length === 0) throw error(409, 'Pothole is not in a fillable state');

	return json({ ok: true });
};
