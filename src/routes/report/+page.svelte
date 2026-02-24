<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	const SEVERITY_OPTIONS = [
		{ value: 'Spilled my coffee', emoji: '🟡', label: 'Spilled my coffee', sub: 'barely there' },
		{ value: 'Bent a rim', emoji: '🟠', label: 'Bent a rim', sub: 'car or bike — you felt that' },
		{ value: 'Caused real damage', emoji: '🔴', label: 'Caused real damage', sub: 'tire, wheel, or worse' },
		{ value: 'RIP', emoji: '☠️', label: 'RIP', sub: 'suspension, wheel, will to live' }
	] as const;

	let lat = $state<number | null>(null);
	let lng = $state<number | null>(null);
	let gpsStatus = $state<'idle' | 'loading' | 'got' | 'error'>('idle');
	let address = $state<string | null>(null);
	let severity = $state<string | null>(null);
	let submitting = $state(false);
	let locationMode = $state<'gps' | 'address' | 'map'>('gps');

	// Address search state
	let addressQuery = $state('');
	let addressSuggestions = $state<Array<{ lat: string; lon: string; display_name: string }>>([]);
	let addressSearching = $state(false);
	let addressDebounce: ReturnType<typeof setTimeout> | null = null;

	// Waterloo Region bounding box for Nominatim: minLon,minLat,maxLon,maxLat
	const WR_VIEWBOX = '-80.59,43.32,-80.22,43.53';

	async function searchAddress(query: string) {
		if (query.trim().length < 3) {
			addressSuggestions = [];
			return;
		}
		addressSearching = true;
		try {
			const params = new URLSearchParams({
				q: query,
				format: 'json',
				limit: '5',
				viewbox: WR_VIEWBOX,
				bounded: '1'
			});
			const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
				headers: { 'User-Agent': 'fillthehole.ca' }
			});
			addressSuggestions = await res.json();
		} catch {
			addressSuggestions = [];
		} finally {
			addressSearching = false;
		}
	}

	function onAddressInput() {
		if (addressDebounce) clearTimeout(addressDebounce);
		addressDebounce = setTimeout(() => searchAddress(addressQuery), 300);
	}

	function selectSuggestion(s: { lat: string; lon: string; display_name: string }) {
		lat = parseFloat(s.lat);
		lng = parseFloat(s.lon);
		address = s.display_name;
		addressQuery = s.display_name;
		addressSuggestions = [];
	}

	// Mini map state
	let miniMapEl = $state<HTMLDivElement | undefined>(undefined);
	let miniMapRef: import('leaflet').Map | null = null;
	let miniPinRef: import('leaflet').Marker | null = null;

	$effect(() => {
		if (locationMode !== 'map') return;

		const timer = setTimeout(async () => {
			if (miniMapRef || !miniMapEl) return;

			const leafletModule = await import('leaflet');
			const L = leafletModule.default ?? leafletModule;

			const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : [43.425, -80.42];
			const map = L.map(miniMapEl, { center, zoom: lat !== null ? 16 : 13 });
			miniMapRef = map;

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
				maxZoom: 19
			}).addTo(map);

			if (lat !== null && lng !== null) {
				miniPinRef = L.marker([lat, lng], { draggable: true }).addTo(map);
				miniPinRef.on('dragend', () => {
					const pos = miniPinRef!.getLatLng();
					lat = pos.lat;
					lng = pos.lng;
					reverseGeocode(pos.lat, pos.lng);
				});
			}

			map.on('click', (e) => {
				lat = e.latlng.lat;
				lng = e.latlng.lng;
				reverseGeocode(e.latlng.lat, e.latlng.lng);

				if (miniPinRef) {
					miniPinRef.setLatLng(e.latlng);
				} else {
					miniPinRef = L.marker(e.latlng, { draggable: true }).addTo(map);
					miniPinRef.on('dragend', () => {
						const pos = miniPinRef!.getLatLng();
						lat = pos.lat;
						lng = pos.lng;
						reverseGeocode(pos.lat, pos.lng);
					});
				}
			});
		}, 50);

		return () => clearTimeout(timer);
	});

	onMount(() => {
		const urlLat = Number($page.url.searchParams.get('lat'));
		const urlLng = Number($page.url.searchParams.get('lng'));

		if (urlLat && urlLng) {
			lat = urlLat;
			lng = urlLng;
			locationMode = 'map';
			reverseGeocode(urlLat, urlLng);
			return;
		}

		getLocation();
	});

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
		if (lat === null || lng === null) return;

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
			<div class="text-sm font-semibold text-zinc-300">📍 Location</div>

			<!-- Tab bar -->
			<div role="tablist" class="flex gap-1 bg-zinc-800 rounded-lg p-1">
				{#each ([['gps', '📍 GPS'], ['address', '🔍 Address'], ['map', '🗺️ Pick on map']] as const) as [mode, label] (mode)}
					<button
						role="tab"
						aria-selected={locationMode === mode}
						type="button"
						onclick={() => (locationMode = mode)}
						class="flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors
							{locationMode === mode
								? 'bg-zinc-700 text-white'
								: 'text-zinc-400 hover:text-zinc-200'}"
					>
						{label}
					</button>
				{/each}
			</div>

			<!-- GPS panel -->
			{#if locationMode === 'gps'}
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
					<p class="text-xs text-red-400" role="alert">
						Location access is required to report a pothole. Please enable it in your browser settings and try again.
					</p>
				{/if}

				{#if address}
					<p class="text-xs text-zinc-400">📌 {address}</p>
				{:else if gpsStatus === 'got'}
					<p class="text-xs text-zinc-400">Looking up address...</p>
				{/if}
			{/if}

			<!-- Address panel -->
			{#if locationMode === 'address'}
				<div class="relative">
					<input
						type="text"
						placeholder="Enter an address or intersection…"
						bind:value={addressQuery}
						oninput={onAddressInput}
						class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
						autocomplete="off"
					/>
					{#if addressSearching}
						<p class="text-xs text-zinc-500 mt-1">Searching…</p>
					{/if}
					{#if addressSuggestions.length > 0}
						<ul
							role="listbox"
							class="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
						>
							{#each addressSuggestions as s (s.display_name)}
								<li
									role="option"
									aria-selected={address === s.display_name}
									class="px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 cursor-pointer"
									onclick={() => selectSuggestion(s)}
									onkeydown={(e) => e.key === 'Enter' && selectSuggestion(s)}
									tabindex="0"
								>
									{s.display_name}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				{#if lat !== null && addressQuery && addressSuggestions.length === 0}
					<p class="text-xs text-zinc-400">📌 {address}</p>
				{/if}
			{/if}

			<!-- Map pin-drop panel -->
			{#if locationMode === 'map'}
				<div bind:this={miniMapEl} class="w-full rounded-lg overflow-hidden" style="height: 260px;"></div>
				{#if lat !== null}
					<p class="text-xs text-zinc-400">
						📌 {address ?? `${lat.toFixed(5)}, ${lng?.toFixed(5)}`} — drag the pin to adjust
					</p>
				{:else}
					<p class="text-xs text-zinc-500">Tap the map to place a pin</p>
				{/if}
			{/if}
		</div>

		<!-- Severity -->
		<fieldset class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<legend class="text-sm font-semibold text-zinc-300 mb-2">💥 How bad is it? (optional)</legend>
			<div class="grid grid-cols-2 gap-2">
				{#each SEVERITY_OPTIONS as opt (opt.value)}
					<label
						class="flex flex-col items-start gap-0.5 p-3 rounded-lg border text-left cursor-pointer transition-colors
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
						<span class="text-xl" aria-hidden="true">{opt.emoji}</span>
						<span class="text-sm font-semibold text-white">{opt.label}</span>
						<span class="text-xs text-zinc-400">{opt.sub}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<button
			type="submit"
			disabled={submitting || lat === null || lng === null}
			class="w-full py-4 font-bold text-lg rounded-xl transition-colors disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed bg-sky-700 hover:bg-sky-600 text-white"
		>
			{submitting ? '⏳ Submitting...' : '📍 Report this hole'}
		</button>

		<p class="text-xs text-zinc-400 text-center">
			Three independent reports from the same location are needed before a pothole appears on the map.
		</p>
		<p class="text-xs text-zinc-400 text-center">
			On a major road? It may be maintained by the Region of Waterloo, not the City. <a href="/about" class="underline hover:text-white">Learn more →</a>
		</p>
	</form>
</div>
