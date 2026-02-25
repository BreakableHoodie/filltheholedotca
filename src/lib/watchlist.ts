/**
 * Watchlist — localStorage-based pothole tracking (no account required).
 *
 * Security notes:
 * - All reads re-validate stored values as UUIDs before use. localStorage can
 *   be tampered with via DevTools or XSS; we never trust stored data blindly.
 * - All writes are wrapped in try/catch — localStorage can throw SecurityError
 *   in private browsing or when storage is full/disabled.
 * - The MAX_ITEMS cap prevents unbounded growth and limits the query string
 *   length sent to /api/watchlist.
 */

const STORAGE_KEY = 'fillthehole_watchlist';
const MAX_ITEMS = 50;

// Strict RFC 4122 UUID pattern — defence against tampered storage values
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(v: unknown): v is string {
	return typeof v === 'string' && UUID_RE.test(v);
}

/** Read and sanitize the watchlist. Never throws. */
export function getWatchlist(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		// Re-validate every entry — don't trust what's in storage
		return parsed.filter(isValidUuid).slice(0, MAX_ITEMS);
	} catch {
		return [];
	}
}

function save(list: string[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
	} catch {
		// Storage quota exceeded or disabled — silently no-op
	}
}

export function isWatched(id: string): boolean {
	return getWatchlist().includes(id);
}

/** Add a pothole to the watchlist. Silently ignores invalid UUIDs and duplicates. */
export function addWatch(id: string): void {
	if (!isValidUuid(id)) return;
	const list = getWatchlist();
	if (list.includes(id) || list.length >= MAX_ITEMS) return;
	save([...list, id]);
}

export function removeWatch(id: string): void {
	save(getWatchlist().filter((i) => i !== id));
}

/**
 * Toggle watch state. Returns the actual persisted state after the operation.
 * Returns false if addWatch no-ops (MAX_ITEMS reached, invalid UUID, storage error).
 */
export function toggleWatch(id: string): boolean {
	if (isWatched(id)) {
		removeWatch(id);
		return false;
	}
	addWatch(id);
	// Re-read storage to reflect the actual outcome — addWatch can no-op silently
	return isWatched(id);
}
