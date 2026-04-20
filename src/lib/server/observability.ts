import * as Sentry from '@sentry/sveltekit';

type LogContext = Record<string, unknown>;

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
		extra: { message, ...(context ?? {}) }
	});
}
