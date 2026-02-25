import type { IconName } from '$lib/icons';

export const STATUS_CONFIG: Record<
	string,
	{ icon: IconName; label: string; colorClass: string; hex: string }
> = {
	pending:  { icon: 'clock',        label: 'Pending confirmation', colorClass: 'text-zinc-400',  hex: '#a1a1aa' },
	reported: { icon: 'map-pin',      label: 'Reported',             colorClass: 'text-orange-400', hex: '#f97316' },
	wanksyd:  { icon: 'flag',         label: 'Flagged',              colorClass: 'text-sky-400',    hex: '#0ea5e9' },
	filled:   { icon: 'check-circle', label: 'Filled',               colorClass: 'text-green-400',  hex: '#22c55e' },
} as const;
