import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
	return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function getSetting(key: string, fallback: string): Promise<string> {
	const { data } = await getAdminClient()
		.from('site_settings')
		.select('value')
		.eq('key', key)
		.single();
	return data?.value ?? fallback;
}

export async function getConfirmationThreshold(): Promise<number> {
	const val = await getSetting('confirmation_threshold', '2');
	const n = parseInt(val, 10);
	return Number.isFinite(n) && n >= 1 ? n : 2;
}
