import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Regression guard for #198: the polling endpoint's `.or(...)` filter must include
// `reported_at.gt.<since>` so a pending -> reported transition (which stamps
// `reported_at` but not `created_at`) is surfaced by /api/potholes/recent polling.
// This is a source-level assertion, not a live-DB behavioural test — the RPC flip
// and the query itself require a real Supabase instance to exercise end-to-end
// (see manual verification steps in the PR description).
test('recent potholes endpoint filters on reported_at alongside created_at/filled_at/expired_at', () => {
	const source = readFileSync(
		fileURLToPath(
			new URL('../../src/routes/api/potholes/recent/+server.ts', import.meta.url),
		),
		'utf-8',
	);

	const orCallMatch = source.match(/\.or\(\s*`([^`]+)`/);
	expect(orCallMatch, 'expected a `.or(`...`)` filter call in the recent potholes endpoint').not.toBeNull();

	const filter = orCallMatch![1];
	expect(filter).toContain('created_at.gt.');
	expect(filter).toContain('reported_at.gt.');
	expect(filter).toContain('filled_at.gt.');
	expect(filter).toContain('expired_at.gt.');
});
