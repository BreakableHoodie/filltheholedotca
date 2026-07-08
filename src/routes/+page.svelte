<script lang="ts">
	import * as Sentry from '@sentry/sveltekit';
	import { goto } from '$app/navigation';
	import HomeIntroCard from '$lib/components/HomeIntroCard.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import WatchlistPanel from '$lib/components/WatchlistPanel.svelte';
	import { STATUS_CONFIG } from '$lib/constants';
	import { escapeHtml } from '$lib/escape';
	import { inWardFeature, roundPublicCoord } from '$lib/geo';
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

	// ── Polling for real-time updates ────────────────────────────────────────
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let lastPoll = $state(Date.now());
	let liveAnnouncement = $state('');

	$effect(() => {
		if (!mapReady) return;
		pollTimer = setInterval(async () => {
			// Quantize the transmitted `since` to a 60s boundary (minus a 5s safety
			// overlap) so every client polling within the same minute requests the
			// same URL — lets the CDN (see api/potholes/recent) serve one shared
			// cached response instead of a unique, uncacheable ms-precision URL per client.
			const since = new Date(Math.floor((lastPoll - 5000) / 60000) * 60000).toISOString();
			try {
				const res = await fetch(`/api/potholes/recent?since=${encodeURIComponent(since)}`);
				if (!res.ok) return;
				const { potholes: updated } = await res.json();
				// Advance on every successful poll, not just when updates arrive, so a
				// quiet tab's `since` window doesn't grow unbounded. The 5s overlap
				// above absorbs the gap between real time and the quantized value sent.
				lastPoll = Date.now();
				if (!updated?.length) return;
				const L = LRef;
				if (!L || !mapRef) return;
				// Announce changes for screen readers
				const newCount = updated.filter((u: { id: string }) => !markersById[u.id]).length;
				if (newCount > 0 || updated.length > 0) {
					const updates = updated.length - newCount;
					const parts: string[] = [];
					if (newCount > 0)
						parts.push(`${newCount} new pothole${newCount !== 1 ? 's' : ''}`);
					if (updates > 0)
						parts.push(`${updates} status update${updates !== 1 ? 's' : ''}`);
					liveAnnouncement = parts.join(', ') + ' on the map.';
				}
				// Build or reuse clientPotholes for reactivity
				if (!clientPotholes) clientPotholes = [...(potholes as Pothole[])];
				for (const p of updated) {
					const existing = markersById[p.id];
					if (existing) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const oldStatus = ((existing as any)._status as string | undefined) ?? 'reported';
						if (oldStatus !== p.status) {
							const layerKey = p.status in clusterGroups ? p.status : 'reported';
							const oldLayerKey = oldStatus in clusterGroups ? oldStatus : 'reported';
							const cg = clusterGroups as Record<
								string,
								{
									removeLayer: (m: typeof existing) => void;
									addLayer: (m: typeof existing) => void;
								}
							>;
							if (oldLayerKey !== layerKey && cg[oldLayerKey] && cg[layerKey]) {
								cg[oldLayerKey].removeLayer(existing);
								cg[layerKey].addLayer(existing);
							}
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							(existing as any)._status = p.status;
						}
						const info =
							STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] ??
							STATUS_CONFIG.reported;
						const address = escapeHtml(
							p.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
						);
						const desc = p.description ? escapeHtml(p.description) : null;
						const detailHref = `/hole/${p.id}`;
						const statusNote =
							p.status === 'reported'
								? 'Seen this too? Open details to watch it, share it, or report it officially.'
								: p.status === 'filled'
									? 'Marked filled by the community. Open details to review the timeline.'
									: 'Archived after no action. Open details if you need the full history.';
						const fixedBtn =
							p.status === 'reported'
								? `<button class="popup-fix-btn" data-action="mark-filled" data-pothole-id="${p.id}">✓ It's fixed!</button>`
								: '';
						existing.setPopupContent(
							`<div class="popup-content">
								<div class="popup-header"><strong>${address}</strong><span class="popup-status popup-status--${p.status}">${info.label}</span></div>
								${desc ? `<em class="popup-desc">${desc}</em>` : ''}
								<p class="popup-note">${statusNote}</p>
								<div class="popup-actions">
									<a href="${detailHref}" class="popup-primary-link">Open details</a>
									<button class="popup-secondary-btn" data-action="share-link" data-pothole-id="${p.id}">Share or copy link</button>
									${fixedBtn}
								</div>
							</div>`,
						);
					} else {
						// New pothole — create a marker on the fly
						const layerKey = p.status in clusterGroups ? p.status : 'reported';
						const group = clusterGroups[layerKey] as
							| { addLayer: (m: typeof existing) => void }
							| undefined;
						if (!group) continue;
						const info =
							STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] ??
							STATUS_CONFIG.reported;
						const iconHtml = `<div class="pothole-marker pothole-marker--${p.status}">${makeSvgIcon(info.icon)}</div>`;
						const icon = L.divIcon({
							html: iconHtml,
							className: '',
							iconSize: [32, 32],
							iconAnchor: [16, 16],
						});
						const marker = L.marker([p.lat, p.lng], { icon });
						markersById[p.id] = marker;
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(marker as any)._status = p.status;
						const address = escapeHtml(
							p.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
						);
						const desc = p.description ? escapeHtml(p.description) : null;
						const detailHref = `/hole/${p.id}`;
						const statusNote =
							p.status === 'reported'
								? 'Seen this too? Open details to watch it, share it, or report it officially.'
								: 'Archived after no action. Open details if you need the full history.';
						marker.bindPopup(
							`<div class="popup-content">
								<div class="popup-header"><strong>${address}</strong><span class="popup-status popup-status--${p.status}">${info.label}</span></div>
								${desc ? `<em class="popup-desc">${desc}</em>` : ''}
								<p class="popup-note">${statusNote}</p>
								<div class="popup-actions">
									<a href="${detailHref}" class="popup-primary-link">Open details</a>
									<button class="popup-secondary-btn" data-action="share-link" data-pothole-id="${p.id}">Share or copy link</button>
								</div>
							</div>`,
							{ maxWidth: 240 },
						);
						group.addLayer(marker);
						clientPotholes = [...clientPotholes, p];
					}
				}
				// Update client-side potholes for derived reactivity
				clientPotholes = clientPotholes.map((cp) => {
					const match = updated.find((u: { id: string }) => u.id === cp.id);
					return match ? { ...cp, ...match } : cp;
				});
			} catch {
				// Silent — polling failures should not degrade UX
			}
		}, 60000);
		return () => {
			if (pollTimer) clearInterval(pollTimer);
		};
	});
	let watchlistSection: HTMLElement | null = null;
	let mobileToolsOpen = $state(false);
	let reportLocating = $state(false);
	let liveReportedCount = $derived(
		potholes.filter((pothole) => pothole.status === 'reported').length,
	);

	let mapRef: Leaflet.Map | null = null;
	let LRef: typeof Leaflet | null = null;
	let markersById: Record<string, Marker> = {};
	let recentReportedPotholes = $derived(
		[...potholes]
			.filter((pothole) => pothole.status === 'reported')
			.sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
			.slice(0, 4),
	);

	type ViewMode = 'map' | 'list';
	type ListStatusFilter = 'all' | 'reported' | 'filled' | 'expired';
	type ListSort = 'newest' | 'oldest' | 'status';

	let viewMode = $state<ViewMode>('map');
	let listStatusFilter = $state<ListStatusFilter>('reported');
	let listSort = $state<ListSort>('newest');

	let visibleListPotholes = $derived(
		[...potholes]
			.filter((pothole) => listStatusFilter === 'all' || pothole.status === listStatusFilter)
			.sort((left, right) => {
				if (listSort === 'oldest') return Date.parse(left.created_at) - Date.parse(right.created_at);
				if (listSort === 'status') {
					const statusOrder = { reported: 0, expired: 1, filled: 2, pending: 3 };
					return statusOrder[left.status] - statusOrder[right.status];
				}
				return Date.parse(right.created_at) - Date.parse(left.created_at);
			}),
	);

	function potholeLabel(pothole: Pothole) {
		return pothole.address || `${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`;
	}

	function formattedDate(iso: string) {
		return iso.slice(0, 10);
	}

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
			toastError(
				'Location is not available in this browser. Tap the map to drop a pin instead.',
			);
			enterReportMode();
			return;
		}

		reportLocating = true;
		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				reportLocating = false;
				goto(
					`/report?lat=${roundPublicCoord(coords.latitude)}&lng=${roundPublicCoord(coords.longitude)}`,
				);
			},
			(error) => {
				reportLocating = false;
				let message = 'Unable to get your location. Tap the map to drop a pin instead.';
				if (error.code === error.PERMISSION_DENIED) {
					message = 'Location access denied. Tap the map to drop a pin instead.';
				} else if (error.code === error.POSITION_UNAVAILABLE) {
					message =
						'Your location is unavailable right now. Tap the map to drop a pin instead.';
				} else if (error.code === error.TIMEOUT) {
					message =
						'Getting your location took too long. Tap the map to drop a pin instead.';
				}
				toastError(message);
				enterReportMode();
			},
			{ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
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
		goto(
			`/report?lat=${roundPublicCoord(reportLatLng.lat)}&lng=${roundPublicCoord(reportLatLng.lng)}`,
		);
	}
	let wardLayerRef: Leaflet.GeoJSON | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let clusterGroups: Record<string, any> = {};

	const layers = $state({
		reported: true,
		expired: false,
		filled: false,
		wards: false,
	});
	let wardLoading = $state(false);
	let locating = $state(false);
	let locationMarker: Marker | null = null;

	function focusPothole(id: string) {
		const map = mapRef;
		const marker = markersById[id];
		if (!map || !marker) return;

		const status = potholes.find((pothole) => pothole.id === id)?.status;
		const layerKey = status === 'filled' || status === 'expired' ? status : 'reported';

		if (!layers[layerKey]) {
			layers[layerKey] = true;
			map.addLayer(clusterGroups[layerKey]);
		}

		mobileToolsOpen = false;
		viewMode = 'map';
		const latLng = marker.getLatLng();
		const targetZoom = Math.max(map.getZoom(), 15);

		// MarkerCluster requires zooming through the cluster before the popup can open.
		if (!clusterGroups[layerKey]?.zoomToShowLayer) {
			map.flyTo(latLng, targetZoom, { duration: 0.6 });
			marker.openPopup();
			return;
		}

		clusterGroups[layerKey].zoomToShowLayer(marker, () => {
			map.flyTo(latLng, targetZoom, { duration: 0.6 });
			marker.openPopup();
		});
	}

	async function showPotholeOnMap(id: string) {
		viewMode = 'map';
		await tick();
		focusPothole(id);
	}

	async function sharePothole(pothole: Pothole) {
		const url = `${window.location.origin}/hole/${pothole.id}`;
		const text = `Pothole at ${potholeLabel(pothole)} in Waterloo Region`;

		try {
			if (navigator.share) {
				await navigator.share({ title: 'FillTheHole.ca pothole report', text, url });
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
	}

	async function markPotholeFilled(id: string) {
		try {
			const res = await fetch('/api/filled', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
			});
			const result = await res.json();
			if (!res.ok && res.status !== 409) throw new Error(result.message || 'Failed');

			toast.success(result.ok ? 'Marked as fixed!' : result.message);
			if (!result.ok) return;

			if (!clientPotholes) clientPotholes = [...(potholes as Pothole[])];
			clientPotholes = clientPotholes.map((pothole) =>
				pothole.id === id
					? { ...pothole, status: 'filled', filled_at: new Date().toISOString() }
					: pothole,
			);

			const marker = markersById[id];
			if (marker) {
				clusterGroups.reported?.removeLayer(marker);
				clusterGroups.filled?.addLayer(marker);
			}
			liveAnnouncement = 'Pothole marked fixed and moved to the filled list.';
		} catch (err: unknown) {
			toastError(err instanceof Error ? err.message : 'Something went wrong');
		}
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
					iconAnchor: [10, 10],
				});
				locationMarker = L.marker([lat, lng], { icon, zIndexOffset: 500 })
					.bindPopup(
						`<div class="popup-content"><strong>You are here</strong><br/><span style="color:#3f3f46;font-size:11px">±${Math.round(accuracy)}m accuracy</span></div>`,
					)
					.addTo(map);

				map.flyTo([lat, lng], 16, { duration: 1.2 });
			},
			(err) => {
				locating = false;
				if (err.code === 1)
					toastError('Location access denied. Enable it in your browser settings.');
				else if (err.code === 2)
					toastError('Could not determine your location. Try again.');
				else toastError('Location request timed out. Try again.');
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
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
					return {
						fillColor: '#f97316',
						fillOpacity: 0.05 + t * 0.45,
						color: '#f97316',
						weight: 1,
						opacity: 0.4,
					};
				},
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				onEachFeature: (f: any, layer: any) => {
					const city = String(f?.properties?.CITY ?? '');
					const w = Number(f?.properties?.WARDID_NORM ?? 0);
					const n = counts[`${city}-${w}`] ?? 0;
					const cityLabel = escapeHtml(city.charAt(0).toUpperCase() + city.slice(1));
					const c = COUNCILLORS.find((x) => x.city === city && x.ward === w);
					const cName = c ? ' — ' + escapeHtml(c.name) : '';
					layer.bindTooltip(
						`<strong>${cityLabel} Ward ${w}${cName}</strong><br/>${n} active hole${n !== 1 ? 's' : ''}`,
						{ sticky: true },
					);
				},
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
				iconAnchor: [16, 16],
			});
		}
		// Report-mode pin shares the 'reported' style but anchors at bottom-center.
		const reportPinIcon = L.divIcon({
			html: `<div class="pothole-marker pothole-marker--reported">${makeSvgIcon('map-pin')}</div>`,
			className: '',
			iconSize: [32, 32],
			iconAnchor: [16, 32],
		});

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

		// One cluster group per status layer
		const statuses = ['reported', 'expired', 'filled'] as const;
		for (const status of statuses) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const group = (L as any).markerClusterGroup({
				maxClusterRadius: 40,
				spiderfyOnMaxZoom: true,
			});
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

			const info =
				STATUS_CONFIG[pothole.status as keyof typeof STATUS_CONFIG] ??
				STATUS_CONFIG.reported;
			const icon = markerIcons[pothole.status] ?? markerIcons['reported'];
			const marker = L.marker([pothole.lat, pothole.lng], { icon });
			markersById[pothole.id] = marker;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(marker as any)._status = pothole.status;

			const address = escapeHtml(
				pothole.address || `${pothole.lat.toFixed(5)}, ${pothole.lng.toFixed(5)}`,
			);
			const description = pothole.description ? escapeHtml(pothole.description) : null;
			const detailHref = `/hole/${pothole.id}`;
			const statusNote =
				pothole.status === 'reported'
					? 'Seen this too? Open details to watch it, share it, or report it officially.'
					: pothole.status === 'filled'
						? 'Marked filled by the community. Open details to review the timeline.'
						: 'Archived after no action. Open details if you need the full history.';

			// "It's fixed!" button only for reported potholes
			const fixedBtn =
				pothole.status === 'reported'
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
				{ maxWidth: 240 },
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
						body: JSON.stringify({ id }),
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
							clientPotholes[idx] = {
								...clientPotholes[idx],
								status: 'filled',
								filled_at: new Date().toISOString(),
							};
						}
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const marker = (e as any).popup._source;
						clusterGroups['reported']?.removeLayer(marker);
						clusterGroups['filled']?.addLayer(marker);
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(marker as any)._status = 'filled';
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
				reportPin = L.marker(e.latlng, {
					draggable: true,
					zIndexOffset: 1000,
					icon: reportPinIcon,
				}).addTo(map);
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
	<meta
		name="description"
		content="Track potholes in Kitchener, Waterloo, and Cambridge. Report, confirm, and hold the city accountable."
	/>
	<meta property="og:title" content="Waterloo Region Pothole Tracker — FillTheHole.ca" />
	<meta
		property="og:description"
		content="Track potholes in Kitchener, Waterloo, and Cambridge. Report, confirm, and hold the city accountable."
	/>
	<meta property="og:url" content="https://fillthehole.ca/" />
	<meta property="og:type" content="website" />
</svelte:head>

<h1 class="sr-only">Waterloo Region Pothole Map and List</h1>

<div class="relative w-full isolate" style="height: calc(100dvh - 57px - env(safe-area-inset-top))">
	<div
		bind:this={mapEl}
		aria-hidden={viewMode === 'list'}
		inert={viewMode === 'list'}
		class="w-full h-full bg-white dark:bg-stone-900 {viewMode === 'list' ? 'pointer-events-none' : ''}"
	></div>

	<div class="absolute top-4 right-4 z-[1002] rounded-md border border-stone-200 dark:border-stone-700 bg-white/95 dark:bg-stone-900/95 p-1 shadow-lg">
		<div class="flex" role="group" aria-label="Choose map or list view">
			{#each [['map', 'Map'], ['list', 'List']] as const as [mode, label] (mode)}
				<button
					type="button"
					aria-pressed={viewMode === mode}
					onclick={() => (viewMode = mode)}
					class="rounded px-3 py-2 text-sm font-semibold transition-colors {viewMode === mode
						? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
						: 'text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white'}"
				>
					{label}
				</button>
			{/each}
		</div>
	</div>

	{#if viewMode === 'list'}
		<section
			id="pothole-list-view"
			class="absolute inset-0 z-[1000] overflow-y-auto bg-stone-50 dark:bg-asphalt px-4 pb-8 pt-20 sm:px-6 lg:px-8"
			aria-labelledby="pothole-list-heading"
		>
			<div class="mx-auto max-w-5xl space-y-4">
				<div class="rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 shadow-sm">
					<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-amber-500">List view</p>
							<h2 id="pothole-list-heading" class="mt-1 font-brand text-3xl font-bold leading-none text-stone-900 dark:text-white">
								Potholes without the map
							</h2>
							<p class="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-300">
								Use filters and keyboard-reachable actions to open details, share a report,
								or mark a live pothole fixed without interacting with map markers.
							</p>
						</div>

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:min-w-[320px]">
							<label class="text-xs font-semibold text-stone-600 dark:text-stone-300">
								Status
								<select
									bind:value={listStatusFilter}
									class="mt-1 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-sm text-stone-900 dark:text-white"
								>
									<option value="reported">Reported</option>
									<option value="filled">Filled</option>
									<option value="expired">Expired</option>
									<option value="all">All statuses</option>
								</select>
							</label>

							<label class="text-xs font-semibold text-stone-600 dark:text-stone-300">
								Sort
								<select
									bind:value={listSort}
									class="mt-1 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-sm text-stone-900 dark:text-white"
								>
									<option value="newest">Newest first</option>
									<option value="oldest">Oldest first</option>
									<option value="status">Status</option>
								</select>
							</label>
						</div>
					</div>
				</div>

				<div class="text-sm text-stone-600 dark:text-stone-300" role="status" aria-live="polite">
					Showing {visibleListPotholes.length} pothole{visibleListPotholes.length === 1 ? '' : 's'}.
				</div>

				{#if visibleListPotholes.length === 0}
					<div class="rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6 text-center text-sm text-stone-600 dark:text-stone-300">
						No potholes match this filter.
					</div>
				{:else}
					<ul class="space-y-3" aria-label="Pothole reports">
						{#each visibleListPotholes as pothole (pothole.id)}
							{@const info = STATUS_CONFIG[pothole.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.reported}
							<li class="rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 shadow-sm">
								<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
									<div class="min-w-0 space-y-2">
										<div class="flex flex-wrap items-center gap-2">
											<span class="inline-flex items-center gap-1.5 rounded border border-stone-200 dark:border-stone-700 px-2 py-1 text-xs font-semibold text-stone-600 dark:text-stone-300">
												<Icon name={info.icon} size={12} class={info.colorClass} />
												{info.label}
											</span>
											<span class="text-xs text-stone-500 dark:text-stone-400">Reported {formattedDate(pothole.created_at)}</span>
											{#if pothole.photos_published}
												<span class="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
													<Icon name="camera" size={12} />
													Photo
												</span>
											{/if}
										</div>

										<h3 class="text-lg font-semibold text-stone-900 dark:text-white">
											<a href="/hole/{pothole.id}" class="underline-offset-4 hover:underline">
												{potholeLabel(pothole)}
											</a>
										</h3>

										<p class="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
											{pothole.description || 'No description provided.'}
										</p>

										<p class="text-xs text-stone-500 dark:text-stone-400">
											Confirmed by {pothole.confirmed_count} report{pothole.confirmed_count === 1 ? '' : 's'} · {pothole.lat.toFixed(4)}, {pothole.lng.toFixed(4)}
										</p>
									</div>

									<div class="flex shrink-0 flex-wrap gap-2 md:max-w-[280px] md:justify-end">
										<a href="/hole/{pothole.id}" class="inline-flex items-center justify-center gap-1.5 rounded-md bg-stone-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200">
											Open details
										</a>
										<button type="button" onclick={() => sharePothole(pothole)} class="inline-flex items-center justify-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm font-semibold text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:text-white">
											<Icon name="share-2" size={14} />
											Share
										</button>
										{#if pothole.status === 'reported'}
											<button type="button" onclick={() => markPotholeFilled(pothole.id)} class="inline-flex items-center justify-center gap-1.5 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900">
												<Icon name="check-circle" size={14} />
												It's fixed
											</button>
										{/if}
										<button type="button" onclick={() => showPotholeOnMap(pothole.id)} class="inline-flex items-center justify-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm font-semibold text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:text-white">
											<Icon name="map" size={14} />
											Show on map
										</button>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/if}
	{#if viewMode === 'map'}
		<HomeIntroCard />
	{/if}

	{#if !mapReady}
		<div class="absolute inset-0 flex items-center justify-center bg-white dark:bg-stone-900">
			<div class="text-center">
				<div
					class="mx-auto w-9 h-9 rounded-full border-2 border-stone-200 dark:border-stone-700 border-t-amber-500 animate-spin mb-4"
				></div>
				<div class="text-sm text-stone-600 dark:text-stone-300">Loading the map…</div>
			</div>
		</div>
	{/if}

	<!-- Report-here banner -->
	{#if reportMode}
		<div
			class="absolute top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[1001] flex flex-wrap items-center gap-2 sm:gap-3 bg-stone-50 dark:bg-asphalt border border-amber-500 rounded-md px-4 py-3 shadow-xl"
		>
			<span
				class="text-sm text-stone-900 dark:text-white grow"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				Tap the map where the pothole is
			</span>
			{#if reportLatLng}
				<button
					type="button"
					onclick={confirmReportLocation}
					class="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
				>
					Confirm location →
				</button>
			{/if}
			<button
				bind:this={cancelReportModeButton}
				type="button"
				onclick={exitReportMode}
				class="text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white text-xs px-2 py-1 rounded transition-colors"
				aria-label="Cancel"
			>
				✕ Cancel
			</button>
		</div>
	{/if}

	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{liveAnnouncement}
	</div>

	{#if mapReady}
		<div class="absolute safe-bottom left-4 z-[1000] hidden sm:flex flex-col gap-2">
			<!-- Find me stays standalone -->
			<button
				onclick={locateMe}
				disabled={locating}
				class="bg-stone-50 dark:bg-asphalt border border-stone-200 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-500 rounded-md px-3 py-2 text-xs text-stone-600 dark:text-stone-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
				class="bg-amber-500 border border-amber-500 hover:border-amber-400 rounded-md px-3 py-2 text-xs text-white font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<Icon name="map-pin" size={12} class="shrink-0" />
				Report here
			</button>

			<!-- Layers panel -->
			<div
				class="bg-stone-50 dark:bg-asphalt border border-stone-200 dark:border-stone-700 rounded-md p-3 space-y-2 text-xs"
			>
				<div class="text-stone-500 dark:text-stone-400 font-semibold text-[10px] mb-1">
					Layers
				</div>

				{#each [['reported', 'Reported'], ['expired', 'Expired'], ['filled', 'Filled']] as const as [key, label] (key)}
					<label
						class="flex items-center gap-2 cursor-pointer text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white"
					>
						<input
							type="checkbox"
							checked={layers[key]}
							onchange={() => toggleLayer(key)}
							class="accent-sky-500"
						/>
						{label}
					</label>
				{/each}

				<div class="border-t border-stone-200 dark:border-stone-700 pt-2">
					<label
						class="flex items-center gap-2 cursor-pointer text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white"
					>
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
		<div
			class="absolute safe-bottom right-4 hidden sm:block bg-stone-50 dark:bg-asphalt border border-stone-200 dark:border-stone-700 rounded-md p-3 text-xs space-y-1.5 z-[1000]"
		>
			<div class="text-stone-500 dark:text-stone-400 font-semibold mb-2 text-[10px]">
				Status
			</div>
			{#each ['reported', 'expired', 'filled'] as status (status)}
				{@const info = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]}
				<div class="flex items-center gap-2 text-stone-600 dark:text-stone-300">
					<Icon name={info.icon} size={12} class={info.colorClass} />
					<span>{info.label}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if mapReady}
		<div class="absolute safe-bottom-mobile-tray inset-x-3 z-[1000] sm:hidden">
			<div
				class="rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xl overflow-hidden flex flex-col"
			>
				<div
					class="shrink-0 flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-stone-200/80 dark:border-stone-800/80"
				>
					<div class="min-w-0">
						<p class="text-[11px] font-semibold text-amber-500">Map tools</p>
						<p
							class="text-sm text-stone-900 dark:text-white font-semibold"
							aria-live="polite"
							aria-atomic="true"
						>
							{liveReportedCount} live pothole{liveReportedCount === 1 ? '' : 's'} on the
							public map
						</p>
						<p class="text-[11px] text-stone-500 dark:text-stone-400">
							Tap a marker for details or drop a pin to report a new one.
						</p>
					</div>
					<button
						type="button"
						onclick={() => (mobileToolsOpen = !mobileToolsOpen)}
						aria-expanded={mobileToolsOpen}
						aria-controls="mobile-map-tools"
						class="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 transition-colors hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white"
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
						class="inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-3 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
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
						class="inline-flex items-center justify-center gap-2 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 px-3 py-3 text-sm font-semibold text-stone-700 dark:text-stone-200 transition-colors hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white disabled:opacity-60"
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
					<div
						id="mobile-map-tools"
						class="border-t border-stone-200 dark:border-stone-800 overflow-y-auto max-h-[50dvh]"
					>
						<div class="px-4 py-3 space-y-4">
							<div class="space-y-2">
								<h2
									class="text-[11px] font-semibold text-stone-500 dark:text-stone-400"
								>
									Recent live reports
								</h2>
								{#if recentReportedPotholes.length > 0}
									<div class="space-y-2">
										{#each recentReportedPotholes as pothole (pothole.id)}
											<button
												type="button"
												onclick={() => focusPothole(pothole.id)}
												class="w-full rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-3 text-left transition-colors hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800"
												aria-label={`Open report for ${pothole.address || `${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}`}
											>
												<div class="flex items-start justify-between gap-3">
													<div class="min-w-0">
														<p
															class="truncate text-sm font-semibold text-stone-900 dark:text-white"
														>
															{pothole.address ||
																`${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}
														</p>
														<p
															class="mt-1 text-[11px] leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-2"
														>
															{pothole.description ||
																'Jump to this marker to review details, share it, or mark it fixed.'}
														</p>
														{#if pothole.photos_published}
															<span
																class="mt-1.5 inline-flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400"
															>
																<Icon name="camera" size={11} />
																Photo
															</span>
														{/if}
													</div>
													<span
														class="shrink-0 rounded bg-stone-100 dark:bg-stone-800 px-2 py-1 text-[10px] font-semibold text-amber-500"
													>
														Open
													</span>
												</div>
											</button>
										{/each}
									</div>
								{:else}
									<p
										class="rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-3 py-3 text-xs leading-relaxed text-stone-500 dark:text-stone-400"
									>
										Live reports will appear here once the community has
										confirmed them.
									</p>
								{/if}
							</div>

							<div class="space-y-2">
								<h2
									class="text-[11px] font-semibold text-stone-500 dark:text-stone-400"
								>
									Layers
								</h2>
								<div class="grid grid-cols-2 gap-2">
									{#each [['reported', 'Reported'], ['expired', 'Expired'], ['filled', 'Filled'], ['wards', 'Ward heatmap']] as const as [key, label] (key)}
										<button
											type="button"
											onclick={() => toggleLayer(key)}
											aria-pressed={layers[key]}
											disabled={key === 'wards' && wardLoading}
											class="inline-flex items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60 {layers[
												key
											]
												? 'border-amber-500 bg-amber-500/10 text-stone-900 dark:text-white'
												: 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white'}"
										>
											<span
												>{key === 'wards' && wardLoading
													? 'Loading…'
													: label}</span
											>
											<span
												class="text-[10px] font-semibold text-stone-500 dark:text-stone-400"
												>{layers[key] ? 'On' : 'Off'}</span
											>
										</button>
									{/each}
								</div>
							</div>

							<div class="space-y-2">
								<h2
									class="text-[11px] font-semibold text-stone-500 dark:text-stone-400"
								>
									Status guide
								</h2>
								<div class="grid grid-cols-1 gap-2">
									{#each ['reported', 'expired', 'filled'] as status (status)}
										{@const info =
											STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]}
										<div
											class="flex items-center gap-2 rounded-md bg-stone-50 dark:bg-stone-900 px-3 py-2 text-xs text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-800"
										>
											<Icon
												name={info.icon}
												size={12}
												class={info.colorClass}
											/>
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
			<div
				class="pointer-events-auto bg-white/95 dark:bg-stone-900/95 border border-stone-200 dark:border-stone-700 rounded-md px-8 py-6 max-w-xs w-full mx-4 text-center shadow-2xl"
			>
				<div
					class="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto mb-3"
				>
					<Icon name="map-pin" size={18} class="text-amber-500" />
				</div>
				<h2 class="text-sm font-semibold text-stone-900 dark:text-white mb-1">
					No potholes reported yet
				</h2>
				<p class="text-xs text-stone-500 dark:text-stone-400 mb-4">
					Be the first to put Waterloo Region's roads on the map.
				</p>
				<a
					href="/report"
					class="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-stone-900 text-xs font-semibold px-4 py-2 rounded-md transition-colors"
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
				class="inline-flex items-center gap-1.5 bg-white dark:bg-stone-900 border border-amber-500 text-amber-500 text-xs font-semibold px-3 py-1.5 rounded-full hover:border-amber-400 hover:text-amber-400 transition-colors shadow-lg"
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
		transition:
			background 0.15s,
			border-color 0.15s;
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
		transition:
			background 0.15s,
			border-color 0.15s;
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
		0% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
		}
		70% {
			box-shadow: 0 0 0 12px rgba(59, 130, 246, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
		}
	}
</style>
