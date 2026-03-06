import { toast } from 'svelte-sonner';

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
