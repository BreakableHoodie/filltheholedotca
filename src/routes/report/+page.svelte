<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	const SEVERITY_OPTIONS = [
		{ value: 'Spilled my coffee',  level: 1, label: 'Spilled my coffee',  sub: 'barely there',                    barColor: 'bg-yellow-400' },
		{ value: 'Bent a rim',         level: 2, label: 'Bent a rim',         sub: 'car or bike — you felt that',     barColor: 'bg-orange-400' },
		{ value: 'Caused real damage', level: 3, label: 'Caused real damage', sub: 'tire, wheel, or worse',           barColor: 'bg-red-400'    },
		{ value: 'RIP',                level: 4, label: 'RIP',                sub: 'suspension, wheel, will to live', barColor: 'bg-rose-400'   },
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
				toast.success('Location locked in');
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
		<h1 class="font-brand font-bold text-3xl text-white mb-1">Report a pothole</h1>
		<p class="text-zinc-400 text-sm">Standing next to one? Lock your GPS and submit.</p>
	</div>

	<form onsubmit={handleSubmit} class="space-y-5">
		<!-- Location -->
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
					<Icon name="crosshair" size={14} class="text-sky-400" />
					Location
				</div>
				{#if gpsStatus === 'got'}
					<span class="flex items-center gap-1 text-xs text-green-400 font-medium">
						<Icon name="check" size={12} strokeWidth={2.5} />
						GPS locked
					</span>
				{/if}
			</div>

			<button
				type="button"
				onclick={getLocation}
				disabled={gpsStatus === 'loading'}
				class="w-full py-3 rounded-lg border-2 border-dashed font-semibold text-sm transition-colors flex items-center justify-center gap-2
					{gpsStatus === 'got'
						? 'border-green-500 bg-green-500/10 text-green-400'
						: gpsStatus === 'error'
						? 'border-red-500 bg-red-500/10 text-red-400'
						: 'border-zinc-700 hover:border-sky-500 hover:bg-sky-500/5 text-zinc-400 hover:text-sky-400'}"
			>
				{#if gpsStatus === 'loading'}
					<Icon name="loader" size={15} class="animate-spin shrink-0" />
					Getting your location…
				{:else if gpsStatus === 'got'}
					<Icon name="check" size={15} strokeWidth={2.5} class="shrink-0" />
					GPS locked
				{:else if gpsStatus === 'error'}
					<Icon name="alert-triangle" size={15} class="shrink-0" />
					GPS failed — tap to retry
				{:else}
					<Icon name="crosshair" size={15} class="shrink-0" />
					Use my current location
				{/if}
			</button>

			{#if gpsStatus === 'error'}
				<p class="text-xs text-red-400" role="alert">
					Location access is required to report a pothole. Please enable it in your browser settings and try again.
				</p>
			{/if}

			{#if address}
				<p class="flex items-center gap-1.5 text-xs text-zinc-400">
					<Icon name="map-pin" size={11} class="shrink-0 text-zinc-500" />
					{address}
				</p>
			{:else if gpsStatus === 'got'}
				<p class="text-xs text-zinc-500">Looking up address…</p>
			{/if}
		</div>

		<!-- Severity -->
		<fieldset class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<legend class="flex items-center gap-2 text-sm font-semibold text-zinc-300 mb-2">
				<Icon name="alert-triangle" size={14} class="text-zinc-400" />
				How bad is it? <span class="text-zinc-600 font-normal">(optional)</span>
			</legend>
			<div class="grid grid-cols-2 gap-2">
				{#each SEVERITY_OPTIONS as opt (opt.value)}
					<label
						class="flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left cursor-pointer transition-colors
							{severity === opt.value
								? 'border-sky-500 bg-sky-500/10'
								: 'border-zinc-700 hover:border-zinc-500'}"
					>
						<input
							type="radio"
							name="severity"
							value={opt.value}
							checked={severity === opt.value}
							onchange={() => severity = opt.value}
							class="sr-only"
						/>
						<!-- Signal-strength damage indicator -->
						<div class="flex items-end gap-0.5 h-4" aria-hidden="true">
							{#each [1, 2, 3, 4] as i}
								<div
									class="w-1.5 rounded-t-sm transition-colors {i <= opt.level ? opt.barColor : 'bg-zinc-700'}"
									style="height: {i * 25}%"
								></div>
							{/each}
						</div>
						<span class="text-sm font-semibold text-white leading-tight">{opt.label}</span>
						<span class="text-xs text-zinc-400 leading-tight">{opt.sub}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<button
			type="submit"
			disabled={submitting || gpsStatus !== 'got'}
			class="w-full py-4 font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed bg-sky-700 hover:bg-sky-600 text-white"
		>
			{#if submitting}
				<Icon name="loader" size={16} class="animate-spin shrink-0" />
				Submitting…
			{:else}
				<Icon name="map-pin" size={16} class="shrink-0" />
				Report this hole
			{/if}
		</button>

		<p class="text-xs text-zinc-400 text-center">
			Reports require GPS. Three independent reports from the same location are needed before a pothole appears on the map.
		</p>
		<p class="text-xs text-zinc-400 text-center">
			On a major road? It may be maintained by the Region of Waterloo, not the City. <a href="/about" class="underline hover:text-white">Learn more →</a>
		</p>
	</form>
</div>
