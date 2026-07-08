import { test, expect } from '@playwright/test';
import { wardSubscribersQuery } from '../../src/lib/server/ward-query';

test('ward subscriber query filters by ward_key', () => {
	const calls: Record<string, unknown> = {};
	const db = {
		from: (t: string) => {
			calls.table = t;
			return db;
		},
		select: (s: string) => {
			calls.select = s;
			return db;
		},
		eq: (col: string, val: string) => {
			calls.eq = [col, val];
			return db;
		}
	} as never;

	// `db` is a minimal chainable test double, not a real Supabase client — cast
	// via `never` above rather than matching the full client type.
	wardSubscribersQuery(db, 'kitchener-6');

	expect(calls.table).toBe('ward_subscriptions');
	expect(calls.select).toBe('endpoint, p256dh, auth');
	expect(calls.eq).toEqual(['ward_key', 'kitchener-6']);
});
