<script lang="ts">
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import Icon from './Icon.svelte';
	import { urlBase64ToUint8Array } from '$lib/push';

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
			if (existing) notifState = 'subscribed';
		} catch {
			// SW registration failed — push unavailable
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
			await fetch('/api/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint, keys })
			});
			notifState = 'subscribed';
		} catch {
			notifState = Notification.permission === 'denied' ? 'denied' : 'unsubscribed';
		}
	}

	async function unsubscribe() {
		if (!registration) return;
		notifState = 'pending';
		try {
			const sub = await registration.pushManager.getSubscription();
			if (sub) {
				await fetch('/api/subscribe', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint: sub.endpoint })
				});
				await sub.unsubscribe();
			}
			notifState = 'unsubscribed';
		} catch {
			notifState = 'subscribed';
		}
	}
</script>

{#if notifState === 'unsubscribed'}
	<button
		onclick={subscribe}
		class="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
		title="Get notified when potholes are fixed"
	>
		<Icon name="bell" size={13} />
		Notify me
	</button>
{:else if notifState === 'subscribed'}
	<button
		onclick={unsubscribe}
		class="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
		title="You're receiving fill notifications — click to turn off"
	>
		<Icon name="bell" size={13} />
		Notified
	</button>
{:else if notifState === 'denied'}
	<span class="inline-flex items-center gap-1.5 text-xs text-zinc-600 cursor-not-allowed" title="Notifications blocked — change in browser settings">
		<Icon name="bell-off" size={13} />
		Blocked
	</span>
{:else if notifState === 'pending'}
	<span class="inline-flex items-center gap-1.5 text-xs text-zinc-400 animate-pulse">
		<Icon name="bell" size={13} />
		…
	</span>
{/if}
