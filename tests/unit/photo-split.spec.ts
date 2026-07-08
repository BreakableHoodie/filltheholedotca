// tests/unit/photo-split.spec.ts
import { test, expect } from '@playwright/test';
import { splitByFill } from '../../src/lib/photo-split';

const p = (created_at: string) => ({ id: created_at, created_at });

test('splits photos before/after filled_at', () => {
	const filledAt = '2026-03-10T12:00:00Z';
	const photos = [p('2026-03-01T00:00:00Z'), p('2026-03-10T12:00:00Z'), p('2026-03-15T00:00:00Z')];
	const { before, after } = splitByFill(photos, filledAt);
	expect(before.map((x) => x.id)).toEqual(['2026-03-01T00:00:00Z']);
	// A photo taken exactly at filled_at counts as "after".
	expect(after.map((x) => x.id)).toEqual(['2026-03-10T12:00:00Z', '2026-03-15T00:00:00Z']);
});

test('null filled_at puts everything in before', () => {
	const photos = [p('2026-03-01T00:00:00Z')];
	const { before, after } = splitByFill(photos, null);
	expect(before).toHaveLength(1);
	expect(after).toHaveLength(0);
});
