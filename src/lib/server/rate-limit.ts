import { error } from '@sveltejs/kit';
import { logError } from '$lib/server/observability';
import type { getAdminClient } from '$lib/server/supabase';

type AdminClient = ReturnType<typeof getAdminClient>;

/**
 * Shared per-IP-scope rate limit for `api_rate_limit_events`: counts events
 * for `ipHash`/`scope` within the trailing `windowMs`, throws
 * `error(429, rateLimitedMessage)` at/over `limit`, then records this
 * attempt. The insert is non-fatal — a broken rate-limit table should never
 * block a legitimate action, so a failure is logged (via `logError`) rather
 * than thrown.
 *
 * Route-specific extra checks (e.g. per-pothole caps in api/hit and
 * api/vote) are separate from this per-IP check and stay inline at the
 * call site.
 */
export async function checkAndRecordRateLimit(
	db: AdminClient,
	ipHash: string,
	scope: string,
	limit: number,
	windowMs: number,
	rateLimitedMessage: string,
	area: string,
	checkFailedMessage = 'Failed to check rate limit',
	context?: Record<string, unknown>
): Promise<void> {
	const windowStart = new Date(Date.now() - windowMs).toISOString();
	const { count, error: countError } = await db
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', scope)
		.gte('created_at', windowStart);

	if (countError) {
		logError(area, `Failed to check ${scope} rate limit`, countError, context);
		throw error(500, checkFailedMessage);
	}
	if ((count ?? 0) >= limit) {
		throw error(429, rateLimitedMessage);
	}

	const { error: insertError } = await db.from('api_rate_limit_events').insert({ ip_hash: ipHash, scope });
	if (insertError) {
		logError(`${area}/ratelimit`, 'Failed to record rate limit event', insertError);
	}
}
