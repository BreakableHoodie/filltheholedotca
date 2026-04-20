import * as Sentry from '@sentry/sveltekit';

type LogContext = Record<string, unknown>;

// Tokens that must never reach third-party telemetry, regardless of caller intent.
// Keys are normalized (lowercased, separators stripped) and blocked if they
// contain any of these tokens as a substring — catches variants like ipHashPrefix.
const BLOCKED_KEY_TOKENS = [
	'lat', 'lng', 'latitude', 'longitude',
	'email', 'address',
	'ip', 'iphash', 'password', 'token', 'secret', 'key',
];

function normalizeKey(key: string): string {
	return key.toLowerCase().replace(/[\s_-]+/g, '');
}

function sanitizeContext(ctx: LogContext): LogContext {
	return Object.fromEntries(
		Object.entries(ctx).filter(([k]) => {
			const norm = normalizeKey(k);
			return !BLOCKED_KEY_TOKENS.some((token) => norm.includes(token));
		})
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
