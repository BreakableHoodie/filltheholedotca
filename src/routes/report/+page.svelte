<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	const SEVERITY_OPTIONS = [
		{ value: 'Spilled my coffee', emoji: '🟡', label: 'Spilled my coffee', sub: 'barely there' },
		{ value: 'Bent a rim', emoji: '🟠', label: 'Bent a rim', sub: 'you felt that' },
		{ value: 'Lost a tire', emoji: '🔴', label: 'Lost a tire', sub: 'genuine damage' },
		{ value: 'RIP', emoji: '☠️', label: 'RIP', sub: 'suspension, alignment, will to live' }
	] as const;

	let lat = $state<number | null>(null);
	let lng = $state<number | null>(null);
	let gpsStatus = $state<'idle' | 'loading' | 'got' | 'error'>('idle');
	let address = $state<string | null>(null);
	let severity = $state<string | null>(null);
	let submitting = $state(false);

	onMount(() => getLocation());

	async function reverseGeocode(lat: number, lng: number) {
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
				{ headers: { 'User-Agent': 'fillthehole.ca' } }
			);
			const data = await res.json();
			const a = data.address ?? {};
			const parts = [a.house_number, a.road, a.suburb].filter(Boolean);
			address = parts.length ? parts.join(' ') : null;
		} catch {
			address = null;
		}
	}

	async function getLocation() {
		if (!navigator.geolocation) {
			toast.error('Geolocation not supported on this device');
			gpsStatus = 'error';
			return;
		}
		gpsStatus = 'loading';
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				lat = pos.coords.latitude;
				lng = pos.coords.longitude;
				gpsStatus = 'got';
				toast.success('📍 Location locked in');
				reverseGeocode(pos.coords.latitude, pos.coords.longitude);
			},
			(err) => {
				gpsStatus = 'error';
				if (err.code === 1) {
					toast.error('Location access denied — enable it in your browser settings and tap retry');
				} else if (err.code === 2) {
					toast.error('Could not determine your location. Try moving outside.');
				} else {
					toast.error('Location request timed out. Tap retry.');
				}
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (gpsStatus !== 'got') return;

		submitting = true;
		try {
			const res = await fetch('/api/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lat, lng, address, description: severity })
			});

			const result = await res.json();
			if (!res.ok) throw new Error(result.message || 'Submission failed');

			toast.success(result.message);
			goto(`/hole/${result.id}`);
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Something went wrong');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Report a pothole — fillthehole.ca</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-white mb-1">Report a pothole 🕳️</h1>
		<p class="text-zinc-400 text-sm">Standing next to a pothole? Lock your GPS and submit.</p>
	</div>

	<form onsubmit={handleSubmit} class="space-y-5">
		<!-- Location -->
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<div class="flex items-center justify-between">
				<div class="text-sm font-semibold text-zinc-300">📍 Location</div>
				{#if gpsStatus === 'got'}
					<span class="text-xs text-green-400 font-medium">GPS locked ✓</span>
				{/if}
			</div>

			<button
				type="button"
				onclick={getLocation}
				disabled={gpsStatus === 'loading'}
				class="w-full py-3 rounded-lg border-2 border-dashed font-semibold text-sm transition-colors
					{gpsStatus === 'got'
						? 'border-green-500 bg-green-500/10 text-green-400'
						: gpsStatus === 'error'
						? 'border-red-500 bg-red-500/10 text-red-400'
						: 'border-zinc-700 hover:border-sky-500 hover:bg-sky-500/5 text-zinc-400 hover:text-sky-400'}"
			>
				{#if gpsStatus === 'loading'}
					⏳ Getting your location...
				{:else if gpsStatus === 'got'}
					✓ GPS locked
				{:else if gpsStatus === 'error'}
					⚠️ GPS failed — tap to retry
				{:else}
					📍 Use my current location
				{/if}
			</button>

			{#if gpsStatus === 'error'}
				<p class="text-xs text-red-400">
					Location access is required to report a pothole. Please enable it in your browser settings and try again.
				</p>
			{/if}

			{#if address}
				<p class="text-xs text-zinc-400">📌 {address}</p>
			{:else if gpsStatus === 'got'}
				<p class="text-xs text-zinc-600">Looking up address...</p>
			{/if}
		</div>

		<!-- Severity -->
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<div class="text-sm font-semibold text-zinc-300">💥 How bad is it? (optional)</div>
			<div class="grid grid-cols-2 gap-2">
				{#each SEVERITY_OPTIONS as opt}
					<button
						type="button"
						onclick={() => severity = severity === opt.value ? null : opt.value}
						class="flex flex-col items-start gap-0.5 p-3 rounded-lg border text-left transition-colors
							{severity === opt.value
								? 'border-sky-500 bg-sky-500/10'
								: 'border-zinc-700 hover:border-zinc-500'}"
					>
						<span class="text-xl">{opt.emoji}</span>
						<span class="text-sm font-semibold text-white">{opt.label}</span>
						<span class="text-xs text-zinc-500">{opt.sub}</span>
					</button>
				{/each}
			</div>
		</div>

		<button
			type="submit"
			disabled={submitting || gpsStatus !== 'got'}
			class="w-full py-4 bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold text-lg rounded-xl transition-colors"
		>
			{submitting ? '⏳ Submitting...' : '📍 Report this hole'}
		</button>

		<p class="text-xs text-zinc-600 text-center">
			Reports require GPS. Three independent reports from the same location are needed before a pothole appears on the map.
		</p>
		<p class="text-xs text-zinc-700 text-center">
			On a major road? It may be maintained by the Region of Waterloo, not the City. <a href="/about" class="underline hover:text-zinc-500">Learn more →</a>
		</p>
	</form>
</div>
