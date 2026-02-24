<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { Map, Marker } from 'leaflet';
	import type * as Leaflet from 'leaflet';
	import type { PageData } from './$types';
	import type { Pothole } from '$lib/types';
	import { COUNCILLORS } from '$lib/wards';
	import { inWardFeature } from '$lib/geo';
	import { STATUS_CONFIG } from '$lib/constants';

	let { data }: { data: PageData } = $props();

	let mapEl: HTMLDivElement;
	let mapReady = $state(false);

	let mapRef: Map | null = null;
	let LRef: typeof Leaflet | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let wardLayerRef: any = null;
	let showWards = $state(false);
	let wardLoading = $state(false);
	let locating = $state(false);
	let locationMarker: Marker | null = null;

	function locateMe() {
		const map = mapRef;
		const L = LRef;
		if (!map || !L) return;

		if (!navigator.geolocation) {
			toast.error('Geolocation is not supported by your browser.');
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				locating = false;
				const { latitude: lat, longitude: lng, accuracy } = coords;

				// Remove previous location marker if any
				if (locationMarker) map.removeLayer(locationMarker);

				// Pulsing blue dot
				const icon = L.divIcon({
					html: '<div class="location-dot"></div>',
					className: '',
					iconSize: [20, 20],
					iconAnchor: [10, 10]
				});
				locationMarker = L.marker([lat, lng], { icon, zIndexOffset: 500 })
					.bindPopup(`<div class="popup-content"><strong>📍 You are here</strong><br/><span style="color:#888;font-size:11px">±${Math.round(accuracy)}m accuracy</span></div>`)
					.addTo(map);

				map.flyTo([lat, lng], 16, { duration: 1.2 });
			},
			(err) => {
				locating = false;
				if (err.code === 1) toast.error('Location access denied. Enable it in your browser settings.');
				else if (err.code === 2) toast.error('Could not determine your location. Try again.');
				else toast.error('Location request timed out. Try again.');
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
		);
	}

	async function toggleWardHeatmap() {
		const map = mapRef;
		const L = LRef;
		if (!map || !L) return;

		if (wardLayerRef) {
				if (showWards) {
					map.removeLayer(wardLayerRef);
				} else {
					map.addLayer(wardLayerRef);
				}
			showWards = !showWards;
			return;
		}
		wardLoading = true;
		try {
			const res = await fetch('/api/wards.geojson');
			if (!res.ok) throw new Error(`Ward boundary fetch failed: ${res.status}`);
			const geojson = await res.json();
			if (!geojson.features?.length) throw new Error('No ward features returned');

			// Count active (reported + wanksyd) potholes per ward, keyed by "city-wardNum"
			const active = (data.potholes as Pothole[]).filter(p => p.status === 'reported' || p.status === 'wanksyd');
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
					const cityLabel = city.charAt(0).toUpperCase() + city.slice(1);
					const c = COUNCILLORS.find(x => x.city === city && x.ward === w);
					layer.bindTooltip(
						`<strong>${cityLabel} Ward ${w}${c ? ' — ' + c.name : ''}</strong><br/>${n} active hole${n !== 1 ? 's' : ''}`,
						{ sticky: true }
					);
				}
			}).addTo(map);
			
			if (wardLayerRef) wardLayerRef.bringToBack();
			showWards = true;
		} catch (err) {
			toast.error('Could not load ward boundaries. Try again later.');
			console.error('[ward heatmap]', err);
		} finally {
			wardLoading = false;
		}
	}

	function escapeHtml(str: string): string {
		return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c));
	}

	onMount(async () => {
		// Leaflet must be imported client-side only
		await import('leaflet/dist/leaflet.css');
		const leafletModule = await import('leaflet');
		const L = leafletModule.default ?? leafletModule;
		// markercluster extends the global L — expose it first
		(window as unknown as Record<string, unknown>).L = L;
		await import('leaflet.markercluster');
		await import('leaflet.markercluster/dist/MarkerCluster.css');
		await import('leaflet.markercluster/dist/MarkerCluster.Default.css');

		LRef = L;

		const map = L.map(mapEl, {
			center: [43.425, -80.42], // Waterloo Region, ON
			zoom: 11
		});
		mapRef = map;

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19
		}).addTo(map);

		// Create marker cluster group
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const markers = (L as any).markerClusterGroup({
			maxClusterRadius: 40,
			spiderfyOnMaxZoom: true
		});

		const potholes = data.potholes as Pothole[];
		for (const pothole of potholes) {
			const info = STATUS_CONFIG[pothole.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.reported;

			const icon = L.divIcon({
				html: `<div class="pothole-marker pothole-marker--${pothole.status}" title="${info.label}">${info.emoji}</div>`,
				className: '',
				iconSize: [36, 36],
				iconAnchor: [18, 18]
			});

			const marker = L.marker([pothole.lat, pothole.lng], { icon });

			const address = escapeHtml(pothole.address || `${pothole.lat.toFixed(5)}, ${pothole.lng.toFixed(5)}`);
			const description = pothole.description ? escapeHtml(pothole.description) : null;
			marker.bindPopup(
				`<div class="popup-content">
					<strong>${info.emoji} ${address}</strong><br/>
					<span class="popup-status popup-status--${pothole.status}">${info.label}</span>
					${description ? `<br/><em>${description}</em>` : ''}
					<br/><a href="/hole/${pothole.id}" class="popup-link">View details →</a>
				</div>`,
				{ maxWidth: 220 }
			);

			markers.addLayer(marker);
		}

		map.addLayer(markers);
		mapReady = true;
	});
</script>

<svelte:head>
	<title>fillthehole.ca — Waterloo Region Pothole Map</title>
</svelte:head>

<!-- Visually hidden page heading for screen readers (WCAG 2.4.6) -->
<h1 class="sr-only">Waterloo Region Pothole Map</h1>

<div class="relative w-full isolate" style="height: calc(100dvh - 57px - env(safe-area-inset-top))">
	<div bind:this={mapEl} class="w-full h-full bg-zinc-900"></div>

	{#if !mapReady}
		<div class="absolute inset-0 flex items-center justify-center bg-zinc-900 text-zinc-400">
			<div class="text-center">
				<div class="text-4xl mb-3">🕳️</div>
				<div class="text-sm">Loading the holes...</div>
			</div>
		</div>
	{/if}

	<!-- Bottom-left controls -->
	{#if mapReady}
		<div class="absolute safe-bottom left-4 z-[1000] flex flex-col gap-2">
			<button
				onclick={locateMe}
				disabled={locating}
				class="bg-zinc-900/90 backdrop-blur border border-zinc-700 hover:border-zinc-500 rounded-xl px-3 py-2 text-xs text-zinc-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
			>
				{locating ? '⏳' : '📍'} {locating ? 'Locating…' : 'Find me'}
			</button>
			<button
				onclick={toggleWardHeatmap}
				disabled={wardLoading}
				class="bg-zinc-900/90 backdrop-blur border border-zinc-700 hover:border-zinc-500 rounded-xl px-3 py-2 text-xs text-zinc-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
				class:border-orange-600={showWards}
				class:text-orange-400={showWards}
			>
				{wardLoading ? '⏳' : '🗺️'} {showWards ? 'Hide heatmap' : 'Ward heatmap'}
			</button>
		</div>
	{/if}

	<!-- Legend -->
	<div class="absolute safe-bottom right-4 bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-xl p-3 text-xs space-y-1.5 z-[1000]">
		<div class="text-zinc-400 font-semibold mb-2 uppercase tracking-wider text-[10px]">Status</div>
			{#each ['reported', 'expired', 'filled'] as status (status)}
			{@const info = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]}
			<div class="flex items-center gap-2 text-zinc-300">
				<span>{info.emoji}</span>
				<span>{info.label}</span>
			</div>
		{/each}
	</div>

	<!-- Pothole count bubble -->
	{#if (data.potholes as Pothole[]).length === 0}
		<div class="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-400 z-[1000]">
			No potholes yet —&nbsp;<a href="/report" class="text-sky-400 hover:text-sky-300 underline">be the first to report one!</a>
		</div>
	{/if}
</div>

<style>
	:global(.pothole-marker) {
		font-size: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		border: 2px solid rgba(255, 255, 255, 0.2);
		cursor: pointer;
		transition: transform 0.15s;
	}

	:global(.pothole-marker:hover) {
		transform: scale(1.2);
	}

	:global(.pothole-marker--reported) {
		border-color: #f97316;
		box-shadow: 0 0 8px rgba(249, 115, 22, 0.5);
	}

	:global(.pothole-marker--wanksyd) {
		border-color: #0ea5e9;
		box-shadow: 0 0 8px rgba(14, 165, 233, 0.5);
	}

	:global(.pothole-marker--filled) {
		border-color: #22c55e;
		box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
	}

	:global(.popup-content) {
		font-family: system-ui, sans-serif;
		font-size: 13px;
		line-height: 1.5;
	}

	:global(.popup-status) {
		display: inline-block;
		font-size: 11px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	:global(.popup-status--reported) { background: #f9731620; color: #f97316; }
	:global(.popup-status--wanksyd) { background: #0ea5e920; color: #0ea5e9; }
	:global(.popup-status--filled) { background: #22c55e20; color: #22c55e; }

	:global(.popup-link) {
		display: inline-block;
		margin-top: 4px;
		color: #0ea5e9;
		font-weight: 600;
		text-decoration: none;
	}
	:global(.popup-link:hover) { text-decoration: underline; }

	:global(.location-dot) {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #3b82f6;
		border: 3px solid white;
		box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
		animation: location-pulse 2s ease-out infinite;
	}

	@keyframes -global-location-pulse {
		0%   { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); }
		70%  { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
		100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
	}
</style>
