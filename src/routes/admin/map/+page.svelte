<script lang="ts">
	import type { PageData } from './$types';
	import type { Pothole } from '$lib/types';
	import { STATUS_CONFIG } from '$lib/constants';
	import { escapeHtml } from '$lib/escape';
	import type * as Leaflet from 'leaflet';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let potholes = $derived(data.potholes as Pothole[]);

	let mapEl: HTMLDivElement;
	let mapRef: Leaflet.Map | null = null;
	let markersById: Record<string, Leaflet.Marker> = {};
	let clusterGroups: Record<string, unknown> = {};
	let mapReady = $state(false);

	let layers = $state({
		pending: true,
		reported: true,
		filled: true,
		expired: false,
	});

	function toggleLayer(key: keyof typeof layers) {
		const group = clusterGroups[key] as Leaflet.LayerGroup<unknown>;
		if (!group || !mapRef) return;
		layers[key] = !layers[key];
		if (layers[key]) {
			mapRef.addLayer(group);
		} else {
			mapRef.removeLayer(group);
		}
	}

	onMount(async () => {
		await import('leaflet/dist/leaflet.css');
		const leafletModule = await import('leaflet');
		const L = leafletModule.default ?? leafletModule;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).L = L;
		await import('leaflet.markercluster');
		await import('leaflet.markercluster/dist/MarkerCluster.css');
		await import('leaflet.markercluster/dist/MarkerCluster.Default.css');

		const markerIcons: Record<string, Leaflet.DivIcon> = {};
		for (const [status] of Object.entries(STATUS_CONFIG)) {
			markerIcons[status] = L.divIcon({
				html: `<div class="pothole-marker pothole-marker--${status}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${
					status === 'pending'
						? '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
						: status === 'reported'
							? '<path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'
							: status === 'filled'
								? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
								: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
				}</svg></div>`,
				className: '',
				iconSize: [32, 32],
				iconAnchor: [16, 16],
			});
		}

		const map = L.map(mapEl, {
			center: [43.425, -80.42],
			zoom: 11,
		});
		mapRef = map;

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(map);

		const statuses = ['pending', 'reported', 'filled', 'expired'] as const;
		for (const status of statuses) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const group = (L as any).markerClusterGroup({
				maxClusterRadius: 40,
				spiderfyOnMaxZoom: true,
			}) as Leaflet.LayerGroup;
			clusterGroups[status] = group;
			if (layers[status]) map.addLayer(group);
		}

		markersById = {};

		for (const pothole of potholes) {
			const layerKey = pothole.status in clusterGroups ? pothole.status : 'reported';
			if (!(layerKey in clusterGroups)) continue;

			const info =
				STATUS_CONFIG[pothole.status as keyof typeof STATUS_CONFIG] ??
				STATUS_CONFIG.reported;
			const icon = markerIcons[pothole.status] ?? markerIcons['reported'];
			const marker = L.marker([pothole.lat, pothole.lng], { icon });
			markersById[pothole.id] = marker;

			const address = escapeHtml(
				pothole.address || `${pothole.lat.toFixed(5)}, ${pothole.lng.toFixed(5)}`,
			);
			const description = pothole.description ? escapeHtml(pothole.description) : null;
			const manageHref = `/admin/potholes/${pothole.id}`;
			const statusLabel = info.label;

			marker.bindPopup(
				`<div class="popup-content">
					<div class="popup-header">
						<strong>${address}</strong>
					</div>
					<p style="margin:2px 0 4px;font-size:11px;color:#52525b">
						<span class="popup-status popup-status--${pothole.status}">${statusLabel}</span>
						<span style="margin-left:6px">${pothole.confirmed_count} conf.</span>
					</p>
					${description ? `<em style="display:block;margin-bottom:4px;font-size:12px;color:#52525b">${description}</em>` : ''}
					<p style="font-size:11px;color:#71717a;margin:0 0 6px">
						${new Date(pothole.created_at).toLocaleDateString()}
						${pothole.filled_at ? `· Filled ${new Date(pothole.filled_at).toLocaleDateString()}` : ''}
					</p>
					<a href="${manageHref}" class="popup-primary-link" style="display:block;text-align:center">Manage →</a>
				</div>`,
				{ maxWidth: 240 },
			);

			(clusterGroups[layerKey] as Leaflet.LayerGroup).addLayer(marker);
		}

		mapReady = true;
	});
</script>

<svelte:head>
	<title>Map — fillthehole.ca Admin</title>
</svelte:head>

<div class="flex flex-col h-full">
	<!-- Layer controls -->
	<div class="flex items-center gap-3 px-4 py-2 bg-stone-900 border-b border-stone-800 flex-wrap">
		<span class="text-xs text-stone-500 font-semibold mr-1">Layers</span>
		{#each [['pending', 'Pending'], ['reported', 'Reported'], ['filled', 'Filled'], ['expired', 'Expired']] as [key, label] (key)}
			<label
				class="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 cursor-pointer transition-colors"
			>
				<input
					type="checkbox"
					checked={layers[key as keyof typeof layers]}
					onchange={() => toggleLayer(key as keyof typeof layers)}
					class="accent-sky-500"
				/>
				{label}
			</label>
		{/each}
		<span class="text-stone-700 text-xs ml-auto tabular-nums">{potholes.length} potholes</span>
	</div>

	<!-- Map -->
	<div class="flex-1 relative">
		<div bind:this={mapEl} class="w-full h-full bg-stone-900"></div>
		{#if !mapReady}
			<div class="absolute inset-0 flex items-center justify-center bg-stone-900">
				<div class="text-center">
					<div
						class="mx-auto w-8 h-8 rounded-full border-2 border-stone-700 border-t-amber-500 animate-spin mb-3"
					></div>
					<div class="text-sm text-stone-500">Loading map…</div>
				</div>
			</div>
		{/if}
	</div>
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
	:global(.pothole-marker--pending) {
		color: #a1a1aa;
		border-color: #a1a1aa;
		box-shadow: 0 0 8px rgba(161, 161, 170, 0.4);
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
	:global(.popup-header strong) {
		font-size: 13px;
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
	:global(.popup-status--reported) {
		background: #f9731620;
		color: #f97316;
	}
	:global(.popup-status--expired) {
		background: #e4e4e7;
		color: #3f3f46;
	}
	:global(.popup-status--filled) {
		background: #22c55e20;
		color: #22c55e;
	}
	:global(.popup-status--pending) {
		background: #a1a1aa20;
		color: #a1a1aa;
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
	}
	:global(.popup-primary-link:hover) {
		background: #075985;
	}
	:global(.leaflet-popup-content-wrapper) {
		border-radius: 8px !important;
	}
</style>
