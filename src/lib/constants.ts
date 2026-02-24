export const STATUS_CONFIG = {
	pending:  { emoji: '⏳', label: 'Pending confirmation', colorClass: 'text-zinc-400',  hex: '#a1a1aa' },
	reported: { emoji: '📍', label: 'Reported',             colorClass: 'text-orange-400', hex: '#f97316' },
	filled:   { emoji: '✅', label: 'Filled',               colorClass: 'text-green-400',  hex: '#22c55e' },
	expired:  { emoji: '🕰️', label: 'Expired',              colorClass: 'text-zinc-500',   hex: '#71717a' },
} as const;
