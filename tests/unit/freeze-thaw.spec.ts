import { test, expect } from '@playwright/test';
import { computeFreezeThawByMonth, lastNMonthKeys } from '../../src/lib/freeze-thaw';

test.describe('computeFreezeThawByMonth', () => {
	test('counts only days that cross 0 °C (low < 0 and high > 0)', () => {
		const daily = {
			time: ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'],
			//      hard freeze    hard freeze    freeze–thaw    fully thawed   freeze–thaw
			tmax: [-7.8, -4.3, 0.4, 8.0, 2.1],
			tmin: [-16.6, -21.6, -10.5, 1.0, -3.0]
		};
		const out = computeFreezeThawByMonth(daily, ['2026-03']);
		// Only 03-03 (0.4 / -10.5) and 03-05 (2.1 / -3.0) qualify.
		expect(out['2026-03']).toBe(2);
	});

	test('seeds every requested month with zero', () => {
		const out = computeFreezeThawByMonth({ time: [], tmax: [], tmin: [] }, ['2026-01', '2026-02']);
		expect(out).toEqual({ '2026-01': 0, '2026-02': 0 });
	});

	test('buckets across a month/year boundary', () => {
		const daily = {
			time: ['2025-12-31', '2026-01-01', '2026-01-02'],
			tmax: [1.0, 0.5, 3.0],
			tmin: [-2.0, -1.0, -0.5]
		};
		const out = computeFreezeThawByMonth(daily, ['2025-12', '2026-01']);
		expect(out['2025-12']).toBe(1);
		expect(out['2026-01']).toBe(2);
	});

	test('skips days with a missing reading', () => {
		const daily = {
			time: ['2026-02-01', '2026-02-02'],
			tmax: [2.0, null],
			tmin: [-3.0, -5.0]
		};
		const out = computeFreezeThawByMonth(daily, ['2026-02']);
		expect(out['2026-02']).toBe(1);
	});

	test('ignores days outside the requested months', () => {
		const daily = {
			time: ['2026-02-10', '2026-03-10'],
			tmax: [1.0, 1.0],
			tmin: [-1.0, -1.0]
		};
		const out = computeFreezeThawByMonth(daily, ['2026-03']);
		expect(out).toEqual({ '2026-03': 1 });
	});

	test('treats exactly 0 °C as neither freeze nor thaw (strict inequalities)', () => {
		const daily = { time: ['2026-03-01', '2026-03-02'], tmax: [0, 5], tmin: [-5, 0] };
		// 03-01 high is exactly 0 (not > 0); 03-02 low is exactly 0 (not < 0). Neither counts.
		const out = computeFreezeThawByMonth(daily, ['2026-03']);
		expect(out['2026-03']).toBe(0);
	});
});

test.describe('lastNMonthKeys', () => {
	test('returns N ascending YYYY-MM keys ending with the anchor month', () => {
		const keys = lastNMonthKeys(4, new Date(2026, 2, 15)); // March 2026
		expect(keys).toEqual(['2025-12', '2026-01', '2026-02', '2026-03']);
	});
});
