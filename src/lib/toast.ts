import { toast } from 'svelte-sonner';

export function toastError(message: string): void {
	toast.error(message, {
		action: {
			label: 'Copy',
			onClick: () => navigator.clipboard.writeText(message).catch(() => {})
		}
	});
}
