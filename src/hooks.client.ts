import * as Sentry from '@sentry/sveltekit';
import { handleErrorWithSentry } from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';

const sentryDsn = env.PUBLIC_SENTRY_DSN;

Sentry.init({
	dsn: sentryDsn || undefined,
	enabled: !!sentryDsn,
	tracesSampleRate: 0.1,
	// Capture session replays only when an error occurs, not every session.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0.5
});

export const handleError = handleErrorWithSentry();
