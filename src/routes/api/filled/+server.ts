import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { hashIp } from '$lib/hash';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

const schema = z.object({ id: z.string().uuid() });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = schema.safeParse(raw);

	if (!parsed.success) throw error(400, 'Invalid request');

	const ipHash = await hashIp(getClientAddress());

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

	const { data: updated, error: updateError } = await supabase
		.from('potholes')
		.update({ status: 'filled', filled_at: new Date().toISOString() })
		.eq('id', parsed.data.id)
		.in('status', ['reported', 'wanksyd']) // Accept reported or legacy wanksyd
		.select('id');

	if (updateError) throw error(500, 'Failed to update status');
	if (!updated || updated.length === 0) throw error(409, 'Pothole is not in a fillable state');

	return json({ ok: true });
};
