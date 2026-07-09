import * as Sentry from '@sentry/sveltekit';
import { handleErrorWithSentry } from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';

const sentryDsn = env.PUBLIC_SENTRY_DSN;

// Replay can capture DOM on error, including admin pages (addresses, admin names,
// moderation notes). Don't rely on Sentry's library defaults for redaction — set the
// masking flags explicitly so PII-safety doesn't silently drift if a dependency bump
// ever changes them. Note: this only suppresses replay on a hard page load that starts
// under /admin — Sentry.init runs once at boot, so client-side (SPA) navigation into
// /admin from elsewhere in the app is not caught by this gate.
const isAdminRoute = typeof location !== 'undefined' && location.pathname.startsWith('/admin');

Sentry.init({
	dsn: sentryDsn || undefined,
	enabled: !!sentryDsn,
	tracesSampleRate: 0.1,
	// Capture session replays only when an error occurs, not every session.
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: isAdminRoute ? 0 : 0.5,
	integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })]
});

export const handleError = handleErrorWithSentry();
