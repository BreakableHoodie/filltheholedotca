// src/lib/photo-split.ts
/**
 * Split a chronological photo list into before/after buckets relative to a
 * pothole's fill time. A photo taken exactly at filled_at counts as "after".
 * When filledAt is null (not yet filled) every photo is "before".
 */
export function splitByFill<T extends { created_at: string }>(
	photos: T[],
	filledAt: string | null
): { before: T[]; after: T[] } {
	if (!filledAt) return { before: [...photos], after: [] };
	const fill = new Date(filledAt).getTime();
	const before: T[] = [];
	const after: T[] = [];
	for (const photo of photos) {
		if (new Date(photo.created_at).getTime() < fill) before.push(photo);
		else after.push(photo);
	}
	return { before, after };
}
