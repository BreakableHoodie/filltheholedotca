import type { IconName } from '$lib/icons';

/** Waterloo Region bounding box used for geofence checks and map views. */
export const GEOFENCE = {
	latMin: 43.32,
	latMax: 43.53,
	lngMin: -80.59,
	lngMax: -80.22
} as const;

/** Radius within which two reports are merged into a single pothole (metres). */
export const MERGE_RADIUS_M = 25;

export const STATUS_CONFIG: Record<
	string,
	{ icon: IconName; label: string; colorClass: string; hex: string }
> = {
	// colorClass carries light + dark variants: the single zinc/400-level values
	// failed WCAG AA (4.5:1) on the light stone surfaces introduced in the redesign
	// (e.g. text-orange-400 ≈ 2:1, text-green-400 ≈ 1.6:1 on white). hex is unchanged
	// — it drives map markers, not body text.
	pending:  { icon: 'clock',        label: 'Pending confirmation', colorClass: 'text-stone-500 dark:text-stone-400',  hex: '#a1a1aa' },
	reported: { icon: 'map-pin',      label: 'Reported',             colorClass: 'text-orange-700 dark:text-orange-400', hex: '#f97316' },
	expired:  { icon: 'clock',        label: 'Expired',              colorClass: 'text-stone-500 dark:text-stone-400',   hex: '#71717a' },
	filled:   { icon: 'check-circle', label: 'Filled',               colorClass: 'text-green-700 dark:text-green-400',  hex: '#22c55e' },
} as const;
