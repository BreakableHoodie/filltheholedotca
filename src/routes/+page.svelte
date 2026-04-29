<script lang="ts">
	import * as Sentry from '@sentry/sveltekit';
	import { goto } from '$app/navigation';
	import HomeIntroCard from '$lib/components/HomeIntroCard.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import WatchlistPanel from '$lib/components/WatchlistPanel.svelte';
	import { STATUS_CONFIG } from '$lib/constants';
	import { escapeHtml } from '$lib/escape';
	import { inWardFeature } from '$lib/geo';
	import { ICONS } from '$lib/icons';
	import { toastError } from '$lib/toast';
	import type { Pothole } from '$lib/types';
	import { COUNCILLORS } from '$lib/wards';
	import { getWatchlist } from '$lib/watchlist';
	import type * as Leaflet from 'leaflet';
	import type { Marker } from 'leaflet';
	import { onMount, onDestroy, tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let fixturePotholes = $state<Pothole[] | null>(null);
	let clientPotholes = $state<Pothole[] | null>(null);
	let potholes = $derived(clientPotholes ?? fixturePotholes ?? (data.potholes as Pothole[]));

	let mapEl: HTMLDivElement;
	let mapReady = $state(false);
	let watchlistCount = $state(0);
	let watchlistSection: HTMLElement | null = null;
	let mobileToolsOpen = $state(false);
	let reportLocating = $state(false);
	let liveReportedCount = $derived(
		potholes.filter((pothole) => pothole.status === 'reported').length
	);

	let mapRef: Leaflet.Map | null = null;
	let LRef: typeof Leaflet | null = null;
	let markersById: Record<string, Marker> = {};
	let recentReportedPotholes = $derived(
		[...potholes]
			.filter((pothole) => pothole.status === 'reported')
			.sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
			.slice(0, 4)
	);

	// Pre-sorted list for the sr-only aside — avoids inline sort on every render.
	let reportedPotholesSorted = $derived(
		potholes
			.filter((p) => p.status === 'reported')
			.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
	);

	// Report-here pin-drop mode
	let reportMode = $state(false);
	let reportLatLng = $state<{ lat: number; lng: number } | null>(null);
	let reportPin: Marker | null = null;
	// Non-reactive mirror for use inside Leaflet closures
	let reportModeRef = false;
	let cancelReportModeButton = $state<HTMLButtonElement | null>(null);

	async function enterReportMode() {
		mobileToolsOpen = false;
		reportMode = true;
		reportModeRef = true;
		reportLatLng = null;
		if (reportPin && mapRef) {
			mapRef.removeLayer(reportPin);
			reportPin = null;
		}
		if (mapRef) mapRef.getContainer().style.cursor = 'crosshair';
		await tick();
		cancelReportModeButton?.focus();
	}

	// Mobile-only: try GPS first, navigate directly to /report if available.
	// Falls back to pin-drop mode if location is denied or unavailable.
	function reportHereFromGps() {
		mobileToolsOpen = false;

		if (!navigator.geolocation) {
			enterReportMode();
			return;
		}

		reportLocating = true;
		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				reportLocating = false;
				goto(`/report?lat=${coords.latitude}&lng=${coords.longitude}`);
			},
			() => {
				reportLocating = false;
				toastError('Location access denied. Tap the map to drop a pin instead.');
				enterReportMode();
			},
			{ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
		);
	}

	function exitReportMode() {
		reportMode = false;
		reportModeRef = false;
		reportLatLng = null;
		if (mapRef) mapRef.getContainer().style.cursor = '';
		if (reportPin && mapRef) {
			mapRef.removeLayer(reportPin);
			reportPin = null;
		}
	}

	function confirmReportLocation() {
		if (!reportLatLng) return;
		mobileToolsOpen = false;
		goto(`/report?lat=${reportLatLng.lat}&lng=${reportLatLng.lng}`);
	}
	let wardLayerRef: Leaflet.GeoJSON | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let clusterGroups: Record<string, any> = {};

	const layers = $state({
		reported: true,
		expired: false,
		filled: false,
		wards: false
	});
	let wardLoading = $state(false);
	let locating = $state(false);
	let locationMarker: Marker | null = null;

	function focusPothole(id: string) {
		const map = mapRef;
		const marker = markersById[id];
		if (!map || !marker) return;

		if (!layers.reported) {
			layers.reported = true;
			map.addLayer(clusterGroups.reported);
		}

		mobileToolsOpen = false;
		const latLng = marker.getLatLng();
		const targetZoom = Math.max(map.getZoom(), 15);

		// MarkerCluster requires zooming through the cluster before the popup can open.
		if (!clusterGroups.reported?.zoomToShowLayer) {
			map.flyTo(latLng, targetZoom, { duration: 0.6 });
			marker.openPopup();
			return;
		}

		clusterGroups.reported.zoomToShowLayer(marker, () => {
			map.flyTo(latLng, targetZoom, { duration: 0.6 });
			marker.openPopup();
		});
	}

	function locateMe() {
		const map = mapRef;
		const L = LRef;
		if (!map || !L) return;
		mobileToolsOpen = false;

		if (!navigator.geolocation) {
			toastError('Geolocation is not supported by your browser.');
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				locating = false;
				const { latitude: lat, longitude: lng, accuracy } = coords;

				if (locationMarker) map.removeLayer(locationMarker);

				const icon = L.divIcon({
					html: '<div class="location-dot"></div>',
					className: '',
					iconSize: [20, 20],
					iconAnchor: [10, 10]
				});
				locationMarker = L.marker([lat, lng], { icon, zIndexOffset: 500 })
					.bindPopup(`<div class="popup-content"><strong>You are here</strong><br/><span style="color:#3f3f46;font-size:11px">±${Math.round(accuracy)}m accuracy</span></div>`)
					.addTo(map);

				map.flyTo([lat, lng], 16, { duration: 1.2 });
			},
			(err) => {
				locating = false;
				if (err.code === 1) toastError('Location access denied. Enable it in your browser settings.');
				else if (err.code === 2) toastError('Could not determine your location. Try again.');
				else toastError('Location request timed out. Try again.');
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
		);
	}

	function toggleLayer(key: keyof typeof layers) {
		if (key === 'wards') {
			toggleWardHeatmap();
			return;
		}
		const group = clusterGroups[key];
		if (!group || !mapRef) return;
		layers[key] = !layers[key];
		if (layers[key]) {
			mapRef.addLayer(group);
		} else {
			mapRef.removeLayer(group);
		}
	}

	async function toggleWardHeatmap() {
		const map = mapRef;
		const L = LRef;
		if (!map || !L) return;

		if (wardLayerRef) {
			if (layers.wards) {
				map.removeLayer(wardLayerRef);
			} else {
				map.addLayer(wardLayerRef);
			}
			layers.wards = !layers.wards;
			return;
		}
		wardLoading = true;
		try {
			const res = await fetch('/api/wards.geojson');
			if (!res.ok) throw new Error(`Ward boundary fetch failed: ${res.status}`);
			const geojson = await res.json();
			if (!geojson.features?.length) throw new Error('No ward features returned');

			// Count active (reported only) potholes per ward
			const active = potholes.filter((p) => p.status === 'reported');
			const counts: Record<string, number> = {};

			for (const ph of active) {
				for (const f of geojson.features) {
					if (inWardFeature(ph.lng, ph.lat, f.geometry)) {
						const city = String(f.properties?.CITY ?? '');
						const w = Number(f.properties?.WARDID_NORM ?? 0);
						if (city && w) {
							const key = `${city}-${w}`;
							counts[key] = (counts[key] ?? 0) + 1;
						}
						break;
					}
				}
			}
			const maxCount = Math.max(...Object.values(counts), 1);

			wardLayerRef = L.geoJSON(geojson, {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				style: (f: any) => {
					const city = String(f?.properties?.CITY ?? '');
					const w = Number(f?.properties?.WARDID_NORM ?? 0);
					const t = (counts[`${city}-${w}`] ?? 0) / maxCount;
					return { fillColor: '#f97316', fillOpacity: 0.05 + t * 0.45, color: '#f97316', weight: 1, opacity: 0.4 };
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				onEachFeature: (f: any, layer: any) => {
					const city = String(f?.properties?.CITY ?? '');
					const w = Number(f?.properties?.WARDID_NORM ?? 0);
					const n = counts[`${city}-${w}`] ?? 0;
					const cityLabel = escapeHtml(city.charAt(0).toUpperCase() + city.slice(1));
					const c = COUNCILLORS.find(x => x.city === city && x.ward === w);
					const cName = c ? ' — ' + escapeHtml(c.name) : '';
					layer.bindTooltip(
						`<strong>${cityLabel} Ward ${w}${cName}</strong><br/>${n} active hole${n !== 1 ? 's' : ''}`,
						{ sticky: true }
					);
				}
			}).addTo(map);

			if (wardLayerRef) wardLayerRef.bringToBack();
			layers.wards = true;
			toast.success('Ward heatmap loaded.');
		} catch (err) {
			toastError('Could not load ward boundaries. Try again later.');
			Sentry.captureException(err, { tags: { area: 'ward-heatmap' } });
		} finally {
			wardLoading = false;
		}
	}

	function makeSvgIcon(iconKey: keyof typeof ICONS): string {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[iconKey]}</svg>`;
	}

	onMount(async () => {
		await import('leaflet/dist/leaflet.css');
		const leafletModule = await import('leaflet');
		const L = leafletModule.default ?? leafletModule;
		(window as unknown as Record<string, unknown>).L = L;
		await import('leaflet.markercluster');
		await import('leaflet.markercluster/dist/MarkerCluster.css');
		await import('leaflet.markercluster/dist/MarkerCluster.Default.css');

		LRef = L;

		// Pre-build one divIcon per status — reused for every marker of that type.
		const markerIcons: Record<string, import('leaflet').DivIcon> = {};
		for (const [status, info] of Object.entries(STATUS_CONFIG)) {
			markerIcons[status] = L.divIcon({
				html: `<div class="pothole-marker pothole-marker--${status}" title="${info.label}">${makeSvgIcon(info.icon)}</div>`,
				className: '',
				iconSize: [32, 32],
				iconAnchor: [16, 16]
			});
		}
		// Report-mode pin shares the 'reported' style but anchors at bottom-center.
		const reportPinIcon = L.divIcon({
			html: `<div class="pothole-marker pothole-marker--reported">${makeSvgIcon('map-pin')}</div>`,
			className: '',
			iconSize: [32, 32],
			iconAnchor: [16, 32]
		});

		const map = L.map(mapEl, {
			center: [43.425, -80.42],
			zoom: 11
		});
		mapRef = map;

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19
		}).addTo(map);

		// One cluster group per status layer
		const statuses = ['reported', 'expired', 'filled'] as const;
		for (const status of statuses) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const group = (L as any).markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true });
			clusterGroups[status] = group;
			if (layers[status]) map.addLayer(group);
		}

		const testWindow = window as Window & { __FTH_E2E_POTHOLES__?: Pothole[] };
		const seededPotholes = Array.isArray(testWindow.__FTH_E2E_POTHOLES__)
			? testWindow.__FTH_E2E_POTHOLES__
			: null;
		const potholesToRender = seededPotholes?.length ? seededPotholes : potholes;
		fixturePotholes = seededPotholes?.length ? seededPotholes : null;
		clientPotholes = seededPotholes?.length ? seededPotholes : null;
		markersById = {};

		for (const pothole of potholesToRender) {
			// Any unknown legacy status falls back to the reported layer.
			const layerKey = pothole.status in clusterGroups ? pothole.status : 'reported';
			if (!(layerKey in clusterGroups)) continue;

			const info = STATUS_CONFIG[pothole.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.reported;
			const icon = markerIcons[pothole.status] ?? markerIcons['reported'];
			const marker = L.marker([pothole.lat, pothole.lng], { icon });
			markersById[pothole.id] = marker;

			const address = escapeHtml(pothole.address || `${pothole.lat.toFixed(5)}, ${pothole.lng.toFixed(5)}`);
			const description = pothole.description ? escapeHtml(pothole.description) : null;
			const detailHref = `/hole/${pothole.id}`;
			const statusNote =
				pothole.status === 'reported'
					? 'Seen this too? Open details to watch it, share it, or report it officially.'
					: pothole.status === 'filled'
						? 'Marked filled by the community. Open details to review the timeline.'
						: 'Archived after no action. Open details if you need the full history.';

			// "It's fixed!" button only for reported potholes
			const fixedBtn = pothole.status === 'reported'
				? `<button class="popup-fix-btn" data-action="mark-filled" data-pothole-id="${pothole.id}">✓ It's fixed!</button>`
				: '';

			marker.bindPopup(
				`<div class="popup-content">
					<div class="popup-header">
						<strong>${address}</strong>
						<span class="popup-status popup-status--${pothole.status}">${info.label}</span>
					</div>
					${description ? `<em class="popup-desc">${description}</em>` : ''}
					<p class="popup-note">${statusNote}</p>
					<div class="popup-actions">
						<a href="${detailHref}" class="popup-primary-link">Open details</a>
						<button class="popup-secondary-btn" data-action="share-link" data-pothole-id="${pothole.id}">Share or copy link</button>
						${fixedBtn}
					</div>
				</div>`,
				{ maxWidth: 240 }
			);

			clusterGroups[layerKey].addLayer(marker);
		}

		// Delegated listener for popup Fixed button
		map.on('popupopen', (e) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const container = (e as any).popup.getElement();
			const shareBtn = container?.querySelector('[data-action="share-link"]');
			const btn = container?.querySelector('[data-action="mark-filled"]');

			if (shareBtn) {
				shareBtn.onclick = async () => {
					const id = shareBtn.getAttribute('data-pothole-id');
					if (!id) return;

					const url = `${window.location.origin}/hole/${id}`;
					try {
						if (navigator.share) {
							await navigator.share({ title: 'FillTheHole.ca pothole report', url });
						} else {
							await navigator.clipboard.writeText(url);
							toast.success('Link copied.');
						}
					} catch (err) {
						if (err instanceof Error && err.name === 'AbortError') return;
						try {
							await navigator.clipboard.writeText(url);
							toast.success('Link copied.');
						} catch {
							toastError('Could not share this link.');
						}
					}
				};
			}

			if (!btn) return;

			btn.onclick = async () => {
				const id = btn.getAttribute('data-pothole-id');
				if (!id) return;

				try {
					const res = await fetch('/api/filled', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ id })
					});
					const result = await res.json();
					if (!res.ok && res.status !== 409) throw new Error(result.message || 'Failed');

					map.closePopup();
					toast.success(result.ok ? 'Marked as fixed!' : result.message);

					// Move marker from reported layer to filled layer.
					if (result.ok) {
						// Targeted delta: mutate only the changed element so $derived consumers
						// don't recalculate the full array on every fill action.
						if (!clientPotholes) clientPotholes = (potholes as Pothole[]).slice();
						const idx = clientPotholes.findIndex((p) => p.id === id);
						if (idx !== -1) {
							clientPotholes[idx] = { ...clientPotholes[idx], status: 'filled', filled_at: new Date().toISOString() };
						}
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const marker = (e as any).popup._source;
						clusterGroups['reported']?.removeLayer(marker);
						clusterGroups['filled']?.addLayer(marker);
					}
				} catch (err: unknown) {
					toastError(err instanceof Error ? err.message : 'Something went wrong');
				}
			};
		});

		// Report-here click handler — uses reportModeRef to avoid stale closure
		map.on('click', (e) => {
			if (!reportModeRef) return;
			reportLatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
			const L = LRef!;
			if (reportPin) {
				reportPin.setLatLng(e.latlng);
			} else {
				reportPin = L.marker(e.latlng, { draggable: true, zIndexOffset: 1000, icon: reportPinIcon }).addTo(map);
				reportPin.on('dragend', () => {
					const pos = reportPin!.getLatLng();
					reportLatLng = { lat: pos.lat, lng: pos.lng };
				});
			}
		});

		mapReady = true;
		watchlistCount = getWatchlist().length;

		// If returning from a detail page with ?focus=ID, fly to and open that marker.
		// The home page caps to 2000 records, so older potholes may not have a marker;
		// fall back to flying to the coordinates encoded in ?lat= and ?lng= if present.
		const focusParams = new URLSearchParams(window.location.search);
		const focusId = focusParams.get('focus');
		if (focusId) {
			await tick();
			if (markersById[focusId]) {
				focusPothole(focusId);
			} else {
				const lat = parseFloat(focusParams.get('lat') ?? '');
				const lng = parseFloat(focusParams.get('lng') ?? '');
				if (!isNaN(lat) && !isNaN(lng) && mapRef) {
					mapRef.flyTo([lat, lng], 15, { duration: 0.6 });
					toast.info('This pothole is not in the current map view.');
				}
			}
		}

	});

	onDestroy(() => {
		mapRef?.remove();
		mapRef = null;
	});
</script>

<svelte:head>
	<title>Waterloo Region Pothole Map — FillTheHole.ca</title>
	<meta name="description" content="Track potholes in Kitchener, Waterloo, and Cambridge. Report, confirm, and hold the city accountable." />
	<meta property="og:title" content="Waterloo Region Pothole Tracker — FillTheHole.ca" />
	<meta property="og:description" content="Track potholes in Kitchener, Waterloo, and Cambridge. Report, confirm, and hold the city accountable." />
	<meta property="og:url" content="https://fillthehole.ca/" />
	<meta property="og:type" content="website" />
</svelte:head>

<h1 class="sr-only">Waterloo Region Pothole Map</h1>

<aside class="sr-only" aria-label="Pothole list">
	<h2 aria-live="polite" aria-atomic="true">Active potholes ({liveReportedCount})</h2>
	{#if liveReportedCount === 0}
		<p>No active potholes reported.</p>
	{:else}
		<ul>
			{#each reportedPotholesSorted as pothole (pothole.id)}
				<li>
					<!-- Skip-link pattern: the link becomes a fixed overlay on keyboard focus
					     so sighted keyboard users see where focus is. -->
					<a
						href="/hole/{pothole.id}"
						class="focus:fixed focus:top-4 focus:left-4 focus:z-[2000] focus:bg-zinc-950 focus:text-sky-400 focus:px-4 focus:py-2 focus:rounded-lg focus:border focus:border-zinc-700 focus:shadow-xl focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
					>
						{pothole.address || `${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}
						— confirmed by {pothole.confirmed_count} report{pothole.confirmed_count === 1 ? '' : 's'}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</aside>

<div class="relative w-full isolate" style="height: calc(100dvh - 57px - env(safe-area-inset-top))">
	<div bind:this={mapEl} class="w-full h-full bg-zinc-900"></div>
	<HomeIntroCard />

	{#if !mapReady}
		<div class="absolute inset-0 flex items-center justify-center bg-zinc-900">
			<div class="text-center">
				<div class="mx-auto w-9 h-9 rounded-full border-2 border-zinc-700 border-t-sky-500 animate-spin mb-4"></div>
				<div class="text-sm text-zinc-300">Loading the map…</div>
			</div>
		</div>
	{/if}

		<!-- Report-here banner -->
		{#if reportMode}
			<div
				class="absolute top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[1001] flex flex-wrap items-center gap-2 sm:gap-3 bg-zinc-950 border border-sky-600 rounded-xl px-4 py-3 shadow-xl"
			>
				<span class="text-sm text-white grow" role="status" aria-live="polite" aria-atomic="true">
					Tap the map where the pothole is
				</span>
				{#if reportLatLng}
				<button
					type="button"
					onclick={confirmReportLocation}
					class="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
				>
					Confirm location →
				</button>
			{/if}
			<button
				bind:this={cancelReportModeButton}
				type="button"
				onclick={exitReportMode}
				class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded transition-colors"
				aria-label="Cancel"
			>
				✕ Cancel
			</button>
		</div>
	{/if}

	{#if mapReady}
		<div class="absolute safe-bottom left-4 z-[1000] hidden sm:flex flex-col gap-2">
			<!-- Find me stays standalone -->
			<button
				onclick={locateMe}
				disabled={locating}
				class="bg-zinc-950 border border-zinc-700 hover:border-zinc-500 rounded-xl px-3 py-2 text-xs text-zinc-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
			>
				{#if locating}
					<Icon name="loader" size={12} class="animate-spin shrink-0" />
					Locating…
				{:else}
					<Icon name="crosshair" size={12} class="shrink-0" />
					Find me
				{/if}
			</button>

			<!-- Report here button -->
			<button
				type="button"
				onclick={enterReportMode}
				aria-pressed={reportMode}
				disabled={reportMode}
				class="bg-sky-700 border border-sky-600 hover:border-sky-400 rounded-xl px-3 py-2 text-xs text-white font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<Icon name="map-pin" size={12} class="shrink-0" />
				Report here
			</button>

			<!-- Layers panel -->
			<div class="bg-zinc-950 border border-zinc-700 rounded-xl p-3 space-y-2 text-xs">
				<div class="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Layers</div>

				{#each ([
					['reported', 'Reported'],
					['expired',  'Expired'],
					['filled',   'Filled'],
				] as const) as [key, label] (key)}
					<label class="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
						<input
							type="checkbox"
							checked={layers[key]}
							onchange={() => toggleLayer(key)}
							class="accent-sky-500"
						/>
						{label}
					</label>
				{/each}

				<div class="border-t border-zinc-700 pt-2">
					<label class="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
						<input
							type="checkbox"
							checked={layers.wards}
							onchange={() => toggleLayer('wards')}
							disabled={wardLoading}
							class="accent-orange-500"
						/>
						{wardLoading ? 'Loading…' : 'Ward heatmap'}
					</label>
				</div>
			</div>
		</div>
	{/if}

	<!-- Legend -->
	{#if mapReady}
		<div class="absolute safe-bottom right-4 hidden sm:block bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs space-y-1.5 z-[1000]">
			<div class="text-zinc-400 font-semibold mb-2 uppercase tracking-wider text-[10px]">Status</div>
			{#each ['reported', 'expired', 'filled'] as status (status)}
				{@const info = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]}
				<div class="flex items-center gap-2 text-zinc-300">
					<Icon name={info.icon} size={12} class={info.colorClass} />
					<span>{info.label}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if mapReady}
		<div class="absolute safe-bottom-mobile-tray inset-x-3 z-[1000] sm:hidden">
			<div class="rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col">
				<div class="shrink-0 flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-zinc-800/80">
					<div class="min-w-0">
						<p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300">Map tools</p>
						<p class="text-sm text-white font-semibold" aria-live="polite" aria-atomic="true">{liveReportedCount} live pothole{liveReportedCount === 1 ? '' : 's'} on the public map</p>
						<p class="text-[11px] text-zinc-400">Tap a marker for details or drop a pin to report a new one.</p>
					</div>
					<button
						type="button"
						onclick={() => (mobileToolsOpen = !mobileToolsOpen)}
						aria-expanded={mobileToolsOpen}
						aria-controls="mobile-map-tools"
						class="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
					>
						<Icon name="layers" size={12} class="shrink-0" />
						{mobileToolsOpen ? 'Hide' : 'Tools'}
					</button>
				</div>

				<div class="shrink-0 grid grid-cols-2 gap-2 px-4 py-3">
					<button
						type="button"
						onclick={reportHereFromGps}
						aria-pressed={reportMode}
						disabled={reportMode || reportLocating}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if reportLocating}
							<Icon name="loader" size={14} class="animate-spin shrink-0" />
							Locating…
						{:else}
							<Icon name="map-pin" size={14} class="shrink-0" />
							Report here
						{/if}
					</button>
					<button
						type="button"
						onclick={locateMe}
						disabled={locating}
						class="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-60"
					>
						{#if locating}
							<Icon name="loader" size={14} class="animate-spin shrink-0" />
							Locating…
						{:else}
							<Icon name="crosshair" size={14} class="shrink-0" />
							Find me
						{/if}
					</button>
				</div>

				{#if mobileToolsOpen}
					<div id="mobile-map-tools" class="border-t border-zinc-800 overflow-y-auto max-h-[50dvh]">
						<div class="px-4 py-3 space-y-4">
						<div class="space-y-2">
							<h2 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Recent live reports</h2>
							{#if recentReportedPotholes.length > 0}
								<div class="space-y-2">
									{#each recentReportedPotholes as pothole (pothole.id)}
										<button
											type="button"
											onclick={() => focusPothole(pothole.id)}
											class="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-800"
											aria-label={`Open report for ${pothole.address || `${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}`}
										>
											<div class="flex items-start justify-between gap-3">
												<div class="min-w-0">
													<p class="truncate text-sm font-semibold text-white">
														{pothole.address || `${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}
													</p>
													<p class="mt-1 text-[11px] leading-relaxed text-zinc-400 line-clamp-2">
														{pothole.description || 'Jump to this marker to review details, share it, or mark it fixed.'}
													</p>
													{#if pothole.photos_published}
														<span class="mt-1.5 inline-flex items-center gap-1 text-[11px] text-zinc-400">
															<Icon name="camera" size={11} />
															Photo
														</span>
													{/if}
												</div>
												<span class="shrink-0 rounded-full bg-zinc-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
													Open
												</span>
											</div>
										</button>
									{/each}
								</div>
							{:else}
								<p class="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-xs leading-relaxed text-zinc-400">
									Live reports will appear here once the community has confirmed them.
								</p>
							{/if}
						</div>

						<div class="space-y-2">
							<h2 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Layers</h2>
							<div class="grid grid-cols-2 gap-2">
								{#each ([
									['reported', 'Reported'],
									['expired', 'Expired'],
									['filled', 'Filled'],
									['wards', 'Ward heatmap']
								] as const) as [key, label] (key)}
									<button
										type="button"
										onclick={() => toggleLayer(key)}
										aria-pressed={layers[key]}
										disabled={key === 'wards' && wardLoading}
										class="inline-flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60 {layers[key] ? 'border-sky-600 bg-sky-500/10 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white'}"
									>
										<span>{key === 'wards' && wardLoading ? 'Loading…' : label}</span>
										<span class="text-[10px] uppercase tracking-wide text-zinc-400">{layers[key] ? 'On' : 'Off'}</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="space-y-2">
							<h2 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Status guide</h2>
							<div class="grid grid-cols-1 gap-2">
								{#each ['reported', 'expired', 'filled'] as status (status)}
									{@const info = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]}
									<div class="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs text-zinc-300 border border-zinc-800">
										<Icon name={info.icon} size={12} class={info.colorClass} />
										<span>{info.label}</span>
									</div>
								{/each}
							</div>
						</div>
					</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if potholes.length === 0 && mapReady}
		<div class="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
			<div class="pointer-events-auto bg-zinc-950/95 border border-zinc-700 rounded-2xl px-8 py-6 max-w-xs w-full mx-4 text-center shadow-2xl">
				<div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
					<Icon name="map-pin" size={18} class="text-sky-400" />
				</div>
				<h2 class="text-sm font-semibold text-white mb-1">No potholes reported yet</h2>
				<p class="text-xs text-zinc-400 mb-4">Be the first to put Waterloo Region's roads on the map.</p>
				<a
					href="/report"
					class="inline-flex items-center gap-1.5 bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
				>
					<Icon name="plus" size={13} strokeWidth={2.5} />
					Report a pothole
				</a>
			</div>
		</div>
	{/if}

	<!-- Watchlist scroll affordance — only visible when user has watched holes -->
	{#if watchlistCount > 0}
		<div class="absolute safe-bottom-watchlist left-1/2 -translate-x-1/2 z-[1000]">
			<button
				onclick={() => watchlistSection?.scrollIntoView({ behavior: 'smooth' })}
				class="inline-flex items-center gap-1.5 bg-zinc-950 border border-sky-800 text-sky-400 text-xs font-semibold px-3 py-1.5 rounded-full hover:border-sky-600 hover:text-sky-300 transition-colors shadow-lg"
				aria-label="Scroll to watchlist"
			>
				<Icon name="bookmark-filled" size={12} class="shrink-0" />
				{watchlistCount} watched
				<Icon name="chevron-down" size={12} class="shrink-0" />
			</button>
		</div>
	{/if}
</div>

<div bind:this={watchlistSection}>
	<WatchlistPanel bind:count={watchlistCount} />
</div>

<style>
	:global(.pothole-marker) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.65);
		border: 2px solid rgba(255, 255, 255, 0.15);
		cursor: pointer;
		transition: transform 0.15s;
	}

	:global(.pothole-marker:hover) {
		transform: scale(1.2);
	}

	:global(.pothole-marker--reported) {
		color: #f97316;
		border-color: #f97316;
		box-shadow: 0 0 8px rgba(249, 115, 22, 0.4);
	}

	:global(.pothole-marker--expired) {
		color: #71717a;
		border-color: #71717a;
		box-shadow: 0 0 8px rgba(113, 113, 122, 0.4);
	}

	:global(.pothole-marker--filled) {
		color: #4ade80;
		border-color: #4ade80;
		box-shadow: 0 0 8px rgba(74, 222, 128, 0.4);
	}

	:global(.popup-content) {
		font-family: system-ui, sans-serif;
		font-size: 13px;
		line-height: 1.5;
		min-width: 180px;
	}

	:global(.popup-header) {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 2px;
	}

	:global(.popup-header strong) {
		flex: 1 1 auto;
	}

	:global(.popup-status) {
		display: inline-block;
		flex-shrink: 0;
		font-size: 11px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 2px;
	}

	:global(.popup-status--reported) { background: #f9731620; color: #f97316; }
	:global(.popup-status--expired)  { background: #e4e4e7; color: #3f3f46; }
	:global(.popup-status--filled)   { background: #22c55e20; color: #22c55e; }

	:global(.popup-desc) {
		display: block;
		color: #52525b;
		margin-bottom: 6px;
	}

	:global(.popup-note) {
		margin: 0;
		color: #52525b;
		font-size: 11px;
		line-height: 1.45;
	}

	:global(.popup-actions) {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid #e4e4e7;
	}

	:global(.popup-primary-link) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 10px;
		background: #0c4a6e;
		color: #ffffff;
		border: 1px solid #0369a1;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}

	:global(.popup-primary-link:hover) {
		background: #075985;
	}

	:global(.popup-secondary-btn) {
		padding: 6px 10px;
		background: #f4f4f5;
		color: #18181b;
		border: 1px solid #d4d4d8;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
		white-space: nowrap;
	}

	:global(.popup-secondary-btn:hover) {
		background: #e4e4e7;
		border-color: #a1a1aa;
	}

	:global(.popup-fix-btn) {
		padding: 6px 10px;
		background: #dcfce7;
		color: #166534;
		border: 1px solid #86efac;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
		white-space: nowrap;
	}
	:global(.popup-fix-btn:hover) {
		background: #bbf7d0;
		border-color: #4ade80;
	}

	:global(.popup-primary-link),
	:global(.popup-secondary-btn),
	:global(.popup-fix-btn) {
		flex: 1 1 calc(50% - 4px);
		min-height: 36px;
	}

	:global(.popup-primary-link:focus-visible),
	:global(.popup-secondary-btn:focus-visible),
	:global(.popup-fix-btn:focus-visible) {
		outline: 2px solid #0ea5e9;
		outline-offset: 2px;
	}

	@media (forced-colors: active) {
		:global(.popup-primary-link),
		:global(.popup-secondary-btn),
		:global(.popup-fix-btn) {
			background: ButtonFace;
			color: ButtonText;
			border-color: ButtonText;
			forced-color-adjust: auto;
		}

		:global(.popup-primary-link:focus-visible),
		:global(.popup-secondary-btn:focus-visible),
		:global(.popup-fix-btn:focus-visible) {
			outline-color: Highlight;
		}
	}

	:global(.location-dot) {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #3b82f6;
		border: 3px solid white;
		box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
		animation: location-pulse 2s ease-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.location-dot) {
			animation: none;
		}
	}

	@keyframes -global-location-pulse {
		0%   { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); }
		70%  { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
		100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
	}
</style>
