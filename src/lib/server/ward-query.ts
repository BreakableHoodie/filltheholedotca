import type { getAdminClient } from '$lib/server/supabase';

/** Build the query selecting active push subscribers for a ward. Pure and
 *  dependency-light so it is unit-testable without $env or a real client. */
export function wardSubscribersQuery(db: ReturnType<typeof getAdminClient>, wardKey: string) {
	return db.from('ward_subscriptions').select('endpoint, p256dh, auth').eq('ward_key', wardKey);
}
