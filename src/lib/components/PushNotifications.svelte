<script lang="ts">
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import Icon from './Icon.svelte';
	import { urlBase64ToUint8Array } from '$lib/push';
	import { toastError, toastErrorFromResponse } from '$lib/toast';

	type NotifState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'pending';

	let notifState: NotifState = $state('unsupported');
	let registration: ServiceWorkerRegistration | null = $state(null);

	const vapidPublicKey = env.PUBLIC_VAPID_PUBLIC_KEY ?? '';

	onMount(async () => {
		if (!vapidPublicKey) return; // Push disabled — VAPID key not configured
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

		notifState = 'unsubscribed';

		try {
			registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

			// Check current permission and subscription state
			if (Notification.permission === 'denied') {
				notifState = 'denied';
				return;
			}
			const existing = await registration.pushManager.getSubscription();
			// 'push-subscribed' records a SERVER-confirmed subscription. A browser
			// subscription alone can be an orphan from a failed POST, or belong only
			// to the per-pothole fill-notify feature (hole/[id]) — showing "Notified"
			// from it alone would misreport server state.
			if (existing && localStorage.getItem('push-subscribed') === '1') {
				notifState = 'subscribed';
			}
		} catch {
			// SW registration failed — push unavailable. Hide the button rather than
			// leaving it in 'unsubscribed' state, which would render a dead control.
			notifState = 'unsupported';
		}
	});

	async function subscribe() {
		if (!registration || !vapidPublicKey) return;
		notifState = 'pending';
		try {
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer
			});
			const { endpoint, keys } = subscription.toJSON() as {
				endpoint: string;
				keys: { p256dh: string; auth: string };
			};
			const res = await fetch('/api/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint, keys })
			});
			if (!res.ok) {
				notifState = 'unsubscribed';
				await toastErrorFromResponse(res, 'Could not turn on notifications. Try again.');
				return;
			}
			// Flag only after the server confirmed the subscription — see onMount.
			localStorage.setItem('push-subscribed', '1');
			notifState = 'subscribed';
		} catch {
			if (Notification.permission === 'denied') {
				// The "Blocked" indicator already communicates this — no toast needed.
				notifState = 'denied';
			} else {
				notifState = 'unsubscribed';
				toastError('Could not turn on notifications. Try again.');
			}
		}
	}

	async function unsubscribe() {
		if (!registration) return;
		notifState = 'pending';
		try {
			const sub = await registration.pushManager.getSubscription();
			if (sub) {
				const res = await fetch('/api/subscribe', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint: sub.endpoint })
				});
				if (!res.ok) {
					notifState = 'subscribed';
					await toastErrorFromResponse(res, 'Could not turn off notifications. Try again.');
					return;
				}
				localStorage.removeItem('push-subscribed');
				await sub.unsubscribe();
			}
			notifState = 'unsubscribed';
		} catch {
			notifState = 'subscribed';
			toastError('Could not turn off notifications. Try again.');
		}
	}
</script>

{#if notifState === 'unsubscribed'}
	<button
		onclick={subscribe}
		class="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors"
		title="Get notified when potholes are fixed"
	>
		<Icon name="bell" size={13} />
		<span class="max-[400px]:sr-only">Notify me</span>
	</button>
{:else if notifState === 'subscribed'}
	<button
		onclick={unsubscribe}
		class="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
		title="You're receiving fill notifications — click to turn off"
	>
		<Icon name="bell" size={13} />
		<span class="max-[400px]:sr-only">Notified</span>
	</button>
{:else if notifState === 'denied'}
	<span class="inline-flex items-center gap-1.5 text-xs text-stone-600 cursor-not-allowed" title="Notifications blocked — change in browser settings">
		<Icon name="bell-off" size={13} />
		<span class="max-[400px]:sr-only">Blocked</span>
	</span>
{:else if notifState === 'pending'}
	<span class="inline-flex items-center gap-1.5 text-xs text-stone-400 animate-pulse">
		<Icon name="bell" size={13} />
		<span class="max-[400px]:sr-only">…</span>
	</span>
{/if}
