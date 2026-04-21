import { getAdminClient } from '$lib/server/supabase';

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
