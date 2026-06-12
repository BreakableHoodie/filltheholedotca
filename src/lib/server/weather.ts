import { z } from 'zod';
import { logError } from '$lib/server/observability';
import { computeFreezeThawByMonth, lastNMonthKeys } from '$lib/freeze-thaw';

// Waterloo Region centroid — a single point is sufficient for a regional
// monthly freeze–thaw trend.
const LAT = 43.46;
const LNG = -80.52;
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

// ERA5 reanalysis lags ~5 days, so the archive rejects very recent end dates.
// Cap the request a few days back; the current month is partial anyway and that
// caveat is disclosed in the chart caption.
const END_LAG_DAYS = 5;
const FETCH_TIMEOUT_MS = 8000;

// Weather history is immutable once past; only the current month grows, so a
// 12h cache keeps us to a few Open-Meteo calls per day — well under the
// 10k/day free non-commercial limit.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const responseSchema = z.object({
	daily: z.object({
		time: z.array(z.string()),
		temperature_2m_max: z.array(z.number().nullable()),
		temperature_2m_min: z.array(z.number().nullable())
	})
});

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

let cache: { key: string; data: Record<string, number>; expiresAt: number } | null = null;

/**
 * Freeze–thaw day counts for the trailing `months` months, keyed `YYYY-MM`.
 * Best-effort: on any failure it logs and returns an all-zero map so the stats
 * chart simply drops its freeze–thaw line rather than breaking the page. No user
 * input reaches the request URL, so there is no SSRF surface.
 */
export async function getFreezeThawByMonth(months: number): Promise<Record<string, number>> {
	const m = Math.min(36, Math.max(1, Math.floor(months)));
	const monthKeys = lastNMonthKeys(m);
	const cacheKey = `${monthKeys[0]}..${monthKeys[monthKeys.length - 1]}`;

	if (cache && cache.key === cacheKey && cache.expiresAt > Date.now()) {
		return cache.data;
	}

	const zero = computeFreezeThawByMonth({ time: [], tmax: [], tmin: [] }, monthKeys);
	const start = `${monthKeys[0]}-01`;
	const end = isoDate(new Date(Date.now() - END_LAG_DAYS * 86_400_000));
	const url =
		`${ARCHIVE_URL}?latitude=${LAT}&longitude=${LNG}` +
		`&start_date=${start}&end_date=${end}` +
		`&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FToronto`;

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));

		if (!res.ok) {
			logError('weather', 'Open-Meteo archive request failed', new Error(`HTTP ${res.status}`));
			return zero;
		}

		const parsed = responseSchema.safeParse(await res.json());
		if (!parsed.success) {
			logError('weather', 'Open-Meteo archive response shape unexpected', parsed.error);
			return zero;
		}

		const d = parsed.data.daily;
		const data = computeFreezeThawByMonth(
			{ time: d.time, tmax: d.temperature_2m_max, tmin: d.temperature_2m_min },
			monthKeys
		);
		cache = { key: cacheKey, data, expiresAt: Date.now() + CACHE_TTL_MS };
		return data;
	} catch (err) {
		logError('weather', 'Open-Meteo archive fetch failed', err);
		return zero;
	}
}
