<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { ICONS } from '$lib/icons';
	import { page } from '$app/stores';

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

	// Photo upload state
	let photoFile = $state<File | null>(null);
	let photoPreview = $state<string | null>(null);
	let photoInput = $state<HTMLInputElement | undefined>(undefined);

	async function resizeImage(file: File): Promise<Blob> {
		return new Promise((resolve) => {
			const MAX_PX = 800;
			const objectUrl = URL.createObjectURL(file);
			const img = new Image();
			img.onload = () => {
				URL.revokeObjectURL(objectUrl);
				const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
				const w = Math.round(img.width * scale);
				const h = Math.round(img.height * scale);
				const canvas = document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
				canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.82);
			};
			img.src = objectUrl;
		});
	}

	async function handlePhotoSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const resized = await resizeImage(file);
		if (photoPreview) URL.revokeObjectURL(photoPreview);
		photoFile = new File([resized], 'photo.jpg', { type: 'image/jpeg' });
		photoPreview = URL.createObjectURL(resized);
	}

	function clearPhoto() {
		if (photoPreview) URL.revokeObjectURL(photoPreview);
		photoFile = null;
		photoPreview = null;
		if (photoInput) photoInput.value = '';
	}

	const LOCATION_TABS = [
		{ mode: 'gps',     label: 'GPS' },
		{ mode: 'address', label: 'Address' },
		{ mode: 'map',     label: 'Pin on map' }
	] as const;
	type LocationMode = (typeof LOCATION_TABS)[number]['mode'];
	let locationMode = $state<LocationMode>('gps');

	// Address search state
	let addressQuery = $state('');
	let addressSuggestions = $state<Array<{ lat: string; lon: string; display_name: string }>>([]);
	let addressSearching = $state(false);
	let addressDebounce: ReturnType<typeof setTimeout> | null = null;
	let addressAbortController: AbortController | null = null;

	// Waterloo Region bounding box for Nominatim: minLon,minLat,maxLon,maxLat
	const WR_VIEWBOX = '-80.59,43.32,-80.22,43.53';

	async function searchAddress(query: string) {
		const trimmedQuery = query.trim();
		if (trimmedQuery.length < 3) {
			addressSuggestions = [];
			addressSearching = false;
			if (addressAbortController) {
				addressAbortController.abort();
				addressAbortController = null;
			}
			return;
		}

		if (addressAbortController) {
			addressAbortController.abort();
		}
		addressAbortController = new AbortController();
		const controller = addressAbortController;

		addressSearching = true;
		try {
			const params = new URLSearchParams({
				q: trimmedQuery,
				format: 'json',
				limit: '5',
				viewbox: WR_VIEWBOX,
				bounded: '1'
			});
			const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
				signal: controller.signal
			});
			if (!res.ok) throw new Error(`Address search failed: ${res.status}`);
			const suggestions = await res.json();
			if (controller.signal.aborted || addressAbortController !== controller) return;
			addressSuggestions = Array.isArray(suggestions) ? suggestions : [];
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			addressSuggestions = [];
		} finally {
			if (addressAbortController === controller) {
				addressSearching = false;
				addressAbortController = null;
			}
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

	function handleLocationTabKeydown(event: KeyboardEvent, mode: LocationMode) {
		const currentIndex = LOCATION_TABS.findIndex((tab) => tab.mode === mode);
		if (currentIndex === -1) return;

		let nextIndex: number | null = null;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			nextIndex = (currentIndex + 1) % LOCATION_TABS.length;
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			nextIndex = (currentIndex - 1 + LOCATION_TABS.length) % LOCATION_TABS.length;
		} else if (event.key === 'Home') {
			nextIndex = 0;
		} else if (event.key === 'End') {
			nextIndex = LOCATION_TABS.length - 1;
		}

		if (nextIndex === null || nextIndex === currentIndex) return;
		event.preventDefault();
		const nextMode = LOCATION_TABS[nextIndex].mode;
		locationMode = nextMode;
		queueMicrotask(() => {
			const tab = document.getElementById(`location-tab-${nextMode}`) as HTMLButtonElement | null;
			tab?.focus();
		});
	}

	$effect(() => {
		if (locationMode !== 'map') {
			if (miniMapRef) {
				miniMapRef.remove();
				miniMapRef = null;
				miniPinRef = null;
			}
			return;
		}

		const timer = setTimeout(async () => {
			if (!miniMapEl || miniMapRef) return;

			await import('leaflet/dist/leaflet.css');
			const leafletModule = await import('leaflet');
			const L = leafletModule.default ?? leafletModule;

			const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : [43.425, -80.42];
			const map = L.map(miniMapEl, { center, zoom: lat !== null ? 16 : 13 });
			miniMapRef = map;

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
				maxZoom: 19
			}).addTo(map);

			const pinIcon = L.divIcon({
				html: `<div style="display:flex;align-items:center;justify-content:center;color:#f97316;width:32px;height:32px"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS['map-pin']}</svg></div>`,
				className: '',
				iconSize: [32, 32],
				iconAnchor: [16, 32]
			});

			if (lat !== null && lng !== null) {
				miniPinRef = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
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
					miniPinRef = L.marker(e.latlng, { draggable: true, icon: pinIcon }).addTo(map);
					miniPinRef.on('dragend', () => {
						const pos = miniPinRef!.getLatLng();
						lat = pos.lat;
						lng = pos.lng;
						reverseGeocode(pos.lat, pos.lng);
					});
				}
			});
			map.invalidateSize();
		}, 50);

		return () => clearTimeout(timer);
	});

	onMount(() => {
		const searchParams = $page.url.searchParams;
		const hasLatParam = searchParams.has('lat');
		const hasLngParam = searchParams.has('lng');
		if (hasLatParam && hasLngParam) {
			const latParam = searchParams.get('lat');
			const lngParam = searchParams.get('lng');
			const urlLat = latParam !== null ? Number(latParam) : NaN;
			const urlLng = lngParam !== null ? Number(lngParam) : NaN;
			if (Number.isFinite(urlLat) && Number.isFinite(urlLng)) {
				lat = urlLat;
				lng = urlLng;
				locationMode = 'map';
				reverseGeocode(urlLat, urlLng);
				return;
			}
		}

		getLocation();

		return () => {
			if (addressDebounce) {
				clearTimeout(addressDebounce);
			}
			if (addressAbortController) {
				addressAbortController.abort();
				addressAbortController = null;
			}
			if (miniMapRef) {
				miniMapRef.remove();
				miniMapRef = null;
				miniPinRef = null;
			}
		};
	});

	async function reverseGeocode(lat: number, lng: number) {
		try {
			const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
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

			// Upload photo if one was selected — non-fatal if it fails
			if (photoFile) {
				const fd = new FormData();
				fd.append('photo', photoFile);
				fd.append('pothole_id', result.id);
				try {
					await fetch('/api/photos', { method: 'POST', body: fd });
				} catch {
					// Photo upload failure does not block navigation
				}
			}

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
	<title>Report a Pothole — FillTheHole.ca</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-8">
	<div class="mb-6">
		<h1 class="font-brand font-bold text-3xl text-white mb-1">Report a pothole</h1>
		<p class="text-zinc-400 text-sm">Standing next to one? Share its location and submit.</p>
	</div>

	<form onsubmit={handleSubmit} class="space-y-5">
		<!-- Location -->
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
				<Icon name="crosshair" size={14} class="text-sky-400" />
				Location
			</div>

			<!-- Tab bar -->
			<div role="tablist" aria-label="Choose a location source" class="flex gap-1 bg-zinc-800 rounded-lg p-1">
				{#each LOCATION_TABS as tab (tab.mode)}
					<button
						id={`location-tab-${tab.mode}`}
						role="tab"
						aria-selected={locationMode === tab.mode}
						aria-controls={`location-panel-${tab.mode}`}
						tabindex={locationMode === tab.mode ? 0 : -1}
						type="button"
						onclick={() => (locationMode = tab.mode)}
						onkeydown={(event) => handleLocationTabKeydown(event, tab.mode)}
						class="flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors
							{locationMode === tab.mode
								? 'bg-zinc-700 text-white'
								: 'text-zinc-400 hover:text-zinc-200'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<!-- GPS panel -->
			<div
				role="tabpanel"
				id="location-panel-gps"
				aria-labelledby="location-tab-gps"
				hidden={locationMode !== 'gps'}
				class="space-y-2"
			>
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
					<p class="text-xs text-zinc-400">Looking up address…</p>
				{/if}
			</div>

			<!-- Address panel -->
			<div
				role="tabpanel"
				id="location-panel-address"
				aria-labelledby="location-tab-address"
				hidden={locationMode !== 'address'}
				class="space-y-2"
			>
				<label for="address-search-input" class="block text-xs font-medium text-zinc-300">Address or intersection</label>
				<div class="relative">
					<input
						id="address-search-input"
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
							data-testid="address-suggestions"
							class="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
						>
							{#each addressSuggestions as s (s.display_name)}
								<li>
									<button
										type="button"
										class="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
										onclick={() => selectSuggestion(s)}
									>
										{s.display_name}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				{#if lat !== null && addressQuery && addressSuggestions.length === 0}
					<p class="flex items-center gap-1.5 text-xs text-zinc-400">
						<Icon name="map-pin" size={11} class="shrink-0 text-zinc-500" />
						{address}
					</p>
				{/if}
			</div>

			<!-- Map pin-drop panel -->
			<div
				role="tabpanel"
				id="location-panel-map"
				aria-labelledby="location-tab-map"
				hidden={locationMode !== 'map'}
				class="space-y-2"
			>
				<div bind:this={miniMapEl} class="w-full rounded-lg overflow-hidden" style="height: 260px;"></div>
				{#if lat !== null}
					<p class="flex items-center gap-1.5 text-xs text-zinc-400">
						<Icon name="map-pin" size={11} class="shrink-0 text-zinc-500" />
						{address ?? `${lat.toFixed(5)}, ${lng?.toFixed(5)}`} — drag the pin to adjust
					</p>
				{:else}
					<p class="text-xs text-zinc-400">Tap the map to place a pin</p>
				{/if}
			</div>
		</div>

		<!-- Severity -->
		<fieldset class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<legend class="flex items-center gap-2 text-sm font-semibold text-zinc-300 mb-2">
				<Icon name="alert-triangle" size={14} class="text-zinc-400" />
				How bad is it? <span class="text-zinc-400 font-normal">(optional)</span>
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
							{#each [1, 2, 3, 4] as i (i)}
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

	<!-- Photo (optional) -->
	<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
		<div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
			<Icon name="camera" size={14} class="text-sky-400" />
			Photo <span class="text-zinc-400 font-normal">(optional)</span>
		</div>

		{#if photoPreview}
			<div class="relative">
				<img src={photoPreview} alt="Selected" class="w-full rounded-lg object-cover aspect-video" />
				<button
					type="button"
					onclick={clearPhoto}
					aria-label="Remove photo"
					class="absolute top-2 right-2 bg-zinc-900/80 hover:bg-zinc-900 rounded-full p-1.5 text-zinc-400 hover:text-white transition-colors"
				>
					<Icon name="x" size={14} />
				</button>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => photoInput?.click()}
				class="w-full py-3 rounded-lg border-2 border-dashed border-zinc-700 hover:border-sky-500 hover:bg-sky-500/5 text-zinc-400 hover:text-sky-400 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
			>
				<Icon name="camera" size={15} class="shrink-0" />
				Add a photo
			</button>
			<input
				bind:this={photoInput}
				id="photo-input"
				type="file"
				accept="image/jpeg,image/png,image/webp"
				class="sr-only"
				aria-label="Upload a pothole photo"
				onchange={handlePhotoSelect}
			/>
		{/if}

		<p class="text-xs text-zinc-400">Photos are reviewed before appearing publicly.</p>
	</div>

		<button
			type="submit"
			disabled={submitting || lat === null || lng === null}
			class="w-full py-4 font-bold text-lg rounded-xl transition-colors flex items-center justify-center gap-2 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed bg-sky-700 hover:bg-sky-600 text-white"
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
			Three independent reports from the same location are needed before a pothole appears on the map.
		</p>
		<p class="text-xs text-zinc-400 text-center">
			On a major road? It may be maintained by the Region of Waterloo, not the City. <a href="/about" class="underline hover:text-white">Learn more →</a>
		</p>
	</form>
</div>
