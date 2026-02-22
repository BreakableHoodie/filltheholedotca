import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

const schema = z.object({ id: z.string().uuid() });

export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = schema.safeParse(raw);

	if (!parsed.success) throw error(400, 'Invalid request');

	const { data: updated, error: updateError } = await supabase
		.from('potholes')
		.update({ status: 'filled', filled_at: new Date().toISOString() })
		.eq('id', parsed.data.id)
		.eq('status', 'wanksyd') // Only transition from wanksyd
		.select('id');

	if (updateError) throw error(500, 'Failed to update status');
	if (!updated || updated.length === 0) throw error(409, 'Pothole is not in wanksyd state');

	return json({ ok: true });
};
