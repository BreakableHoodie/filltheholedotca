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
	import { escapeHtml } from '$lib/escape';

	let { data }: { data: PageData } = $props();

	let mapEl: HTMLDivElement;
	let mapReady = $state(false);

	let mapRef: Map | null = null;
	let LRef: typeof Leaflet | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let wardLayerRef: any = null;
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

				if (locationMarker) map.removeLayer(locationMarker);

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
			const active = (data.potholes as Pothole[]).filter(p => p.status === 'reported');
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
			layers.wards = true;
		} catch (err) {
			toast.error('Could not load ward boundaries. Try again later.');
			console.error('[ward heatmap]', err);
		} finally {
			wardLoading = false;
		}
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

		const potholes = data.potholes as Pothole[];
		for (const pothole of potholes) {
			// Legacy wanksyd rows (pre-migration DB rows) fall back to the reported layer.
			// Cast to string since 'wanksyd' is no longer part of PotholeStatus.
			const layerKey = (pothole.status as string) === 'wanksyd' ? 'reported' : pothole.status;
			if (!(layerKey in clusterGroups)) continue;

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

			// "Fixed" button only for reported potholes (Task 9)
			const fixedBtn = pothole.status === 'reported'
				? `<button class="popup-fix-btn" data-action="mark-filled" data-pothole-id="${pothole.id}">✓ Fixed</button>`
				: '';

			marker.bindPopup(
				`<div class="popup-content">
					<strong>${info.emoji} ${address}</strong><br/>
					<span class="popup-status popup-status--${pothole.status}">${info.label}</span>
					${description ? `<br/><em>${description}</em>` : ''}
					<br/><a href="/hole/${pothole.id}" class="popup-link">View details →</a>
					${fixedBtn}
				</div>`,
				{ maxWidth: 220 }
			);

			clusterGroups[layerKey].addLayer(marker);
		}

		// Delegated listener for popup Fixed button (Task 9)
		map.on('popupopen', (e) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const container = (e as any).popup.getElement();
			const btn = container?.querySelector('[data-action="mark-filled"]');
			if (!btn) return;

			btn.addEventListener('click', async () => {
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
					toast.success(result.ok ? '✅ Marked as fixed!' : result.message);

					// Move marker from reported layer to filled layer
					if (result.ok) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const marker = (e as any).popup._source;
						clusterGroups['reported']?.removeLayer(marker);
						if (layers.filled) clusterGroups['filled']?.addLayer(marker);
					}
				} catch (err: unknown) {
					toast.error(err instanceof Error ? err.message : 'Something went wrong');
				}
			});
		});

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

	{#if mapReady}
		<div class="absolute safe-bottom left-4 z-[1000] flex flex-col gap-2">
			<!-- Find me stays standalone -->
			<button
				onclick={locateMe}
				disabled={locating}
				class="bg-zinc-900/90 backdrop-blur border border-zinc-700 hover:border-zinc-500 rounded-xl px-3 py-2 text-xs text-zinc-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
			>
				{locating ? '⏳' : '📍'} {locating ? 'Locating…' : 'Find me'}
			</button>

			<!-- Layers panel -->
			<div class="bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-xl p-3 space-y-2 text-xs">
				<div class="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-1">🗂 Layers</div>

				{#each ([
					['reported', '📍 Reported'],
					['expired',  '🕰️ Expired'],
					['filled',   '✅ Filled'],
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
						{wardLoading ? '⏳ Loading…' : '🗺️ Ward heatmap'}
					</label>
				</div>
			</div>
		</div>
	{/if}

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

	:global(.pothole-marker--expired) {
		border-color: #71717a;
		box-shadow: 0 0 8px rgba(113, 113, 122, 0.4);
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
	:global(.popup-status--expired)  { background: #71717a20; color: #71717a; }
	:global(.popup-status--filled)   { background: #22c55e20; color: #22c55e; }

	:global(.popup-link) {
		display: inline-block;
		margin-top: 4px;
		color: #0ea5e9;
		font-weight: 600;
		text-decoration: none;
	}
	:global(.popup-link:hover) { text-decoration: underline; }

	:global(.popup-fix-btn) {
		display: inline-block;
		margin-top: 6px;
		padding: 3px 10px;
		background: #16a34a20;
		color: #22c55e;
		border: 1px solid #22c55e40;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}
	:global(.popup-fix-btn:hover) { background: #16a34a40; }

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
