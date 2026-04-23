/**
 * Shared in-process store for Playwright E2E fixture data.
 *
 * Both the /api/report and /api/photos endpoints import from here so that the
 * photo endpoint can validate that a pothole actually exists in the fixture
 * store before accepting a photo upload — mirroring the real endpoint's
 * pothole existence check.
 *
 * This module is only active when PLAYWRIGHT_E2E_FIXTURES === 'true'. It must
 * never be imported in production code paths; the guard at each call site
 * (process.env.PLAYWRIGHT_E2E_FIXTURES) prevents any runtime effect in prod.
 */

export type FixturePothole = { id: string; lat: number; lng: number; confirmed_count: number };

/** Keyed by pothole UUID. */
export const fixturePotholes = new Map<string, FixturePothole>();
