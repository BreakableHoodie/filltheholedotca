// Pure freeze–thaw helpers — intentionally free of any framework, server, or
// network imports so they can be unit-tested directly (Playwright's unit runner
// has no `$lib` alias). A freeze–thaw day is what cracks pavement and spawns
// potholes: a daily low below 0 °C together with a daily high above 0 °C.

export interface DailyTemps {
	time: string[];
	tmax: Array<number | null>;
	tmin: Array<number | null>;
}

/**
 * Count freeze–thaw days per `YYYY-MM` bucket. Days with a missing reading, or
 * whose month is not in `monthKeys`, are skipped. Returns a map seeded with a
 * zero for every requested month so callers always get a complete series.
 */
export function computeFreezeThawByMonth(
	daily: DailyTemps,
	monthKeys: string[]
): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const k of monthKeys) counts[k] = 0;

	const n = Math.min(daily.time.length, daily.tmax.length, daily.tmin.length);
	for (let i = 0; i < n; i++) {
		const tmin = daily.tmin[i];
		const tmax = daily.tmax[i];
		if (tmin == null || tmax == null) continue;
		if (tmin < 0 && tmax > 0) {
			const key = daily.time[i].slice(0, 7);
			if (key in counts) counts[key] += 1;
		}
	}
	return counts;
}

/** The trailing `months` month keys ending with the current month, as `YYYY-MM`. */
export function lastNMonthKeys(months: number, now: Date = new Date()): string[] {
	const keys: string[] = [];
	for (let i = months - 1; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
	}
	return keys;
}
