/**
 * Shared in-process store for Playwright E2E fixture data.
 *
 * Both the /api/report and /api/photos endpoints import from here so that the
 * photo endpoint can validate that a pothole actually exists in the fixture
 * store before accepting a photo upload — mirroring the real endpoint's
 * pothole existence check.
 *
 * This module is only used when PLAYWRIGHT_E2E_FIXTURES === 'true' and
 * CI === 'true'. It must never be read from or mutated outside fixture mode;
 * the guard at each call site (process.env.PLAYWRIGHT_E2E_FIXTURES &&
 * process.env.CI) prevents any fixture behavior from activating in production.
 */

export type FixturePothole = { id: string; lat: number; lng: number; confirmed_count: number };

/** Keyed by pothole UUID. */
export const fixturePotholes = new Map<string, FixturePothole>();
