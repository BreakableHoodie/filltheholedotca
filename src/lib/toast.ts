import { toast } from 'svelte-sonner';

/**
 * Show a failure toast for a non-ok fetch Response. For 4xx responses, surfaces
 * the server's own `message` body (SvelteKit's `error()` helper serializes to
 * `{ message: string }`) since it's often actionable — e.g. a 429 retry-after
 * hint or a 409 "already filled" — where a generic toast tells the user
 * nothing new. 5xx responses always get `fallback`: server error bodies aren't
 * meant for end users and can leak internals.
 */
export async function toastErrorFromResponse(res: Response, fallback: string): Promise<void> {
	if (res.status >= 400 && res.status < 500) {
		const body: unknown = await res.json().catch(() => null);
		const message =
			body && typeof body === 'object' && 'message' in body ? body.message : undefined;
		if (typeof message === 'string' && message.trim()) {
			toastError(message);
			return;
		}
	}
	toastError(fallback);
}

export function toastError(message: string): void {
	const hasClipboard =
		typeof navigator !== 'undefined' &&
		typeof navigator.clipboard?.writeText === 'function';

	toast.error(message, {
		...(hasClipboard
			? {
					action: {
						label: 'Copy',
						onClick: () => navigator.clipboard.writeText(message).catch(() => {})
					}
				}
			: {})
	});
}
