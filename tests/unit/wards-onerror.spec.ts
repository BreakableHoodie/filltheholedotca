import { test, expect } from '@playwright/test';
import { fetchWards } from '../../src/lib/wards';

// Regression guard for #204 (M6): fetchWards() swallowed fetch failures entirely —
// a persistent ArcGIS outage was invisible to the operator. It now accepts an
// optional onError callback so server callers can route failures through logError
// (see src/lib/server/wards.ts) while the client-bundled src/lib/wards.ts itself
// stays free of any $lib/server import.
//
// NOTE on the module-level ward cache: it persists for the life of the worker
// process, so each test below uses a DISTINCT city (kitchener/waterloo/cambridge).
// That keeps every test independent whether Playwright runs them in parallel
// workers (fresh module per worker) or sequentially in one worker (shared cache,
// e.g. CI with workers=1).

test('fetchWards reports onError once when fetch rejects, suppressing repeats via the failure cache', async () => {
	const originalFetch = globalThis.fetch;
	const networkError = new Error('network down');
	const calls: Array<{ message: string; err: unknown }> = [];
	const onError = (message: string, err: unknown) => calls.push({ message, err });

	try {
		globalThis.fetch = (() => Promise.reject(networkError)) as typeof fetch;

		const result = await fetchWards('kitchener', onError);
		expect(result).toEqual([]);
		expect(calls.length).toBe(1);
		expect(calls[0].message).toContain('kitchener');
		expect(calls[0].err).toBe(networkError);

		// Immediate second call for the same city hits the failure cache and
		// must not re-invoke onError — otherwise a persistent outage would spam
		// an error report on every call instead of once per retry window.
		const second = await fetchWards('kitchener', onError);
		expect(second).toEqual([]);
		expect(calls.length).toBe(1);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('fetchWards retries once and recovers from a transient failure without reporting onError', async () => {
	const originalFetch = globalThis.fetch;
	const calls: Array<{ message: string; err: unknown }> = [];
	const onError = (message: string, err: unknown) => calls.push({ message, err });
	const features = [
		{
			type: 'Feature',
			properties: { WARD_NO: 1 },
			geometry: { type: 'Polygon', coordinates: [] },
		},
	];
	let fetchCalls = 0;

	try {
		// ArcGIS is a third-party service with no SLA — a single transient blip
		// (here, one bad response) must not poison the 5-minute failure cache if
		// the very next attempt succeeds.
		globalThis.fetch = (() => {
			fetchCalls++;
			if (fetchCalls === 1) return Promise.resolve({ ok: false, status: 502 } as Response);
			return Promise.resolve({
				ok: true,
				status: 200,
				json: async () => ({ features }),
			} as Response);
		}) as typeof fetch;

		const result = await fetchWards('waterloo', onError);

		expect(result).toEqual(features);
		expect(fetchCalls).toBe(2);
		expect(calls.length).toBe(0);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('fetchWards treats an HTTP 200 ArcGIS error body (no features) as a cached failure', async () => {
	const originalFetch = globalThis.fetch;
	const calls: Array<{ message: string; err: unknown }> = [];
	const onError = (message: string, err: unknown) => calls.push({ message, err });
	let fetchCalls = 0;

	try {
		// ArcGIS REST services can return HTTP 200 with `{"error": {...}}` in the
		// body and no `features` key. This must be treated as a failure, not a
		// legitimate empty ward set — these three cities always have wards.
		globalThis.fetch = (() => {
			fetchCalls++;
			return Promise.resolve({
				ok: true,
				status: 200,
				json: async () => ({ error: { code: 498 } }),
			} as Response);
		}) as typeof fetch;

		const result = await fetchWards('cambridge', onError);
		expect(result).toEqual([]);
		expect(calls.length).toBe(1);
		expect(calls[0].message).toContain('cambridge');
		expect(calls[0].message).toContain('malformed');
		// One retry before giving up — both attempts hit the same malformed body.
		expect(fetchCalls).toBe(2);

		// The failure must land in the FAILURE cache (5-min retry hold), not the
		// success cache — an immediate second call must neither refetch
		// (thundering-herd protection) nor re-report.
		const second = await fetchWards('cambridge', onError);
		expect(second).toEqual([]);
		expect(fetchCalls).toBe(2);
		expect(calls.length).toBe(1);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
