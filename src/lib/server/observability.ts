import * as Sentry from '@sentry/sveltekit';

type LogContext = Record<string, unknown>;

// Keys that must never reach third-party telemetry, regardless of caller intent.
const BLOCKED_CONTEXT_KEYS = new Set([
	'lat', 'lng', 'latitude', 'longitude',
	'email', 'address',
	'ip', 'iphash', 'ip_hash',
	'password', 'token', 'secret', 'key',
]);

function sanitizeContext(ctx: LogContext): LogContext {
	return Object.fromEntries(
		Object.entries(ctx).filter(([k]) => !BLOCKED_CONTEXT_KEYS.has(k.toLowerCase()))
	);
}

/**
 * Log an error to console AND Sentry. Use this instead of bare `console.error`
 * inside any `try/catch` that swallows an error and keeps running. Sentry's
 * default `handleErrorWithSentry` only fires on *unhandled* throws, so every
 * catch-and-continue path is otherwise invisible in production.
 *
 * `area` is a short tag (e.g. 'photos', 'webpush', 'og/ward') that Sentry
 * indexes for filtering.
 */
export function logError(area: string, message: string, err: unknown, context?: LogContext): void {
	console.error(`[${area}] ${message}:`, err);
	Sentry.captureException(err, {
		tags: { area },
		extra: { message, ...(context ? sanitizeContext(context) : {}) }
	});
}
