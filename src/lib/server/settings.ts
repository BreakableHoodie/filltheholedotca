import { getAdminClient } from '$lib/server/supabase';
import { logError } from '$lib/server/observability';

export async function getSetting(key: string, fallback: string): Promise<string> {
	const { data, error } = await getAdminClient()
		.from('site_settings')
		.select('value')
		.eq('key', key)
		.maybeSingle();
	if (error) {
		// Key goes in the message, not the context object — the observability
		// sanitizer strips any context key containing the token "key".
		logError('settings', `site_settings lookup failed for "${key}"`, error);
	}
	return data?.value ?? fallback;
}

export async function getConfirmationThreshold(): Promise<number> {
	const val = await getSetting('confirmation_threshold', '2');
	const n = parseInt(val, 10);
	return Number.isFinite(n) && n >= 1 ? n : 2;
}
