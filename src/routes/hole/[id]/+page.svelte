<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import { STATUS_CONFIG } from '$lib/constants';
	import {
	  CITY_REPORT_LINKS,
	  MTO_REPORT_LINK,
	  REGION_REPORT_LINK
	} from '$lib/official-reporting';
	import { resizeImage } from '$lib/image';
	import { toastError } from '$lib/toast';
	import { getPotholeEmailUrl } from '$lib/email';
	import type { Pothole } from '$lib/types';
	import type { Councillor } from '$lib/wards';
	import { isWatched, toggleWatch } from '$lib/watchlist';
	import { format } from 'date-fns';
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let pothole = $derived(data.pothole as Pothole);
	let info = $derived(STATUS_CONFIG[pothole.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.reported);
	let councillor = $derived(data.councillor as Councillor | null);
	let origin = $derived(data.origin as string);
	let cityRepairRequests = $derived(data.cityRepairRequests ?? []);
	let photos = $derived(data.photos ?? []);
	let confirmationThreshold = $derived(data.confirmationThreshold);
	let submitted = $derived(page.url.searchParams.get('submitted') === '1');
	let officialCityLink = $derived(councillor ? CITY_REPORT_LINKS[councillor.city] : null);
	let nearbyFilled = $derived(data.nearbyFilled ?? []);

	// ── "I hit this" signal ────────────────────────────────────────────────
	let hitCount = $state(untrack(() => data.hitCount) ?? 0);
	let hitSubmitted = $state(false);
	let hittingIt = $state(false);

	onMount(() => {
		const key = `hit:${pothole.id}`;
		hitSubmitted = localStorage.getItem(key) === '1';
	});

	async function recordHit() {
		if (hitSubmitted || hittingIt) return;
		hittingIt = true;
		try {
			const res = await fetch('/api/hit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: pothole.id })
			});
			if (!res.ok) {
				toastError('Something went wrong. Try again.');
				return;
			}
			const result = await res.json();
			hitCount = result.count ?? hitCount;
			localStorage.setItem(`hit:${pothole.id}`, '1');
			hitSubmitted = true;
			toast.success('Recorded! Your experience helps prioritize repairs.');
		} catch {
			toastError('Something went wrong. Try again.');
		} finally {
			hittingIt = false;
		}
	}

	let ogDescription = $derived(
		pothole.status === 'filled'
			? `This pothole at ${pothole.address || 'this location'} has been filled. Accountability worked.`
			: `Unfilled pothole at ${pothole.address || 'this location'} in Waterloo Region. Help get it filled.`
	);

	let jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'Place',
			name: `Pothole at ${pothole.address || 'unknown location'}`,
			description: ogDescription,
			geo: {
				'@type': 'GeoCoordinates',
				latitude: pothole.lat,
				longitude: pothole.lng
			},
			url: `${origin}/hole/${pothole.id}`,
			dateCreated: pothole.created_at,
			...(pothole.filled_at ? { dateModified: pothole.filled_at } : {}),
			additionalProperty: [
				{ '@type': 'PropertyValue', name: 'status', value: pothole.status },
				{ '@type': 'PropertyValue', name: 'confirmedBy', value: pothole.confirmed_count }
			]
		// Prevent closing-tag sequences from ending this inline script prematurely.
		}).replace(new RegExp('<' + '/script', 'gi'), '<\\/script')
	);

	let submitting = $state(false);
	let showFilledForm = $state(false);

	// Photo upload state
	let photoFile = $state<File | null>(null);
	let photoPreview = $state<string | null>(null);
	let photoInput = $state<HTMLInputElement | undefined>(undefined);
	let uploadingPhoto = $state(false);
	let photoSubmitted = $state(false);

	let canUploadPhoto = $derived(
		(pothole.status === 'pending' || pothole.status === 'reported') && !photoSubmitted
	);

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

	async function uploadPhoto() {
		if (!photoFile) return;
		uploadingPhoto = true;
		try {
			const fd = new FormData();
			fd.append('photo', photoFile);
			fd.append('pothole_id', pothole.id);
			const res = await fetch('/api/photos', { method: 'POST', body: fd });
			if (!res.ok) {
				let message = 'Upload failed';
				try {
					const result = await res.json();
					if (result.message) message = result.message;
				} catch {
					// Non-JSON error body — use generic message
				}
				throw new Error(message);
			}
			toast.success("Photo submitted — it'll appear here once reviewed.");
			clearPhoto();
			photoSubmitted = true;
		} catch (err: unknown) {
			toastError(err instanceof Error ? err.message : 'Photo upload failed');
		} finally {
			uploadingPhoto = false;
		}
	}

	// Lightbox
	let lightboxIndex = $state<number | null>(null);
	let lightboxTriggerEl: HTMLElement | null = null;
	let lightboxCloseBtn = $state<HTMLButtonElement | null>(null);
	let lightboxDialogEl = $state<HTMLDivElement | null>(null);
	let lightboxOpen = false; // non-reactive — tracks open/closed across effect re-runs

	function openLightbox(index: number) {
		const active = document.activeElement;
		lightboxTriggerEl = active instanceof HTMLElement ? active : null;
		lightboxIndex = index;
	}
	function closeLightbox() { lightboxIndex = null; }
	function prevPhoto() { if (lightboxIndex !== null) lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length; }
	function nextPhoto() { if (lightboxIndex !== null) lightboxIndex = (lightboxIndex + 1) % photos.length; }

	$effect(() => {
		if (lightboxIndex === null) return;
		document.body.style.overflow = 'hidden';
		// Only move focus on initial open (null → non-null). Navigating prev/next
		// re-runs this effect but must not yank focus back to the close button.
		if (!lightboxOpen) lightboxCloseBtn?.focus();
		lightboxOpen = true;
		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') { closeLightbox(); return; }
			if (e.key === 'ArrowLeft') { prevPhoto(); return; }
			if (e.key === 'ArrowRight') { nextPhoto(); return; }
			// Trap Tab within the dialog — prevents focus escaping to header/nav.
			if (e.key === 'Tab' && lightboxDialogEl) {
				const focusable = Array.from(
					lightboxDialogEl.querySelectorAll<HTMLElement>('button:not([disabled])')
				);
				if (focusable.length === 0) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				if (e.shiftKey) {
					if (document.activeElement === first) { e.preventDefault(); last.focus(); }
				} else {
					if (document.activeElement === last) { e.preventDefault(); first.focus(); }
				}
			}
		}
		window.addEventListener('keydown', onKeydown);
		return () => {
			window.removeEventListener('keydown', onKeydown);
			// Always restore scroll — covers both normal close and component unmount
			// (when lightboxIndex is still non-null and the page is being torn down).
			document.body.style.overflow = '';
			if (lightboxIndex === null) {
				lightboxTriggerEl?.focus();
				lightboxOpen = false;
			}
		};
	});

	// Watch state — initialised on mount to avoid SSR/hydration mismatch
	let watching = $state(false);
	let watchMounted = $state(false);

	onMount(() => {
		watching = isWatched(pothole.id);
		watchMounted = true;
	});

	function handleWatch() {
		watching = toggleWatch(pothole.id);
		toast.success(watching ? 'Added to your watchlist.' : 'Removed from watchlist.');
	}

	async function markFilled() {
		submitting = true;
		try {
			const res = await fetch('/api/filled', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: pothole.id })
			});
			if (!res.ok) throw new Error((await res.json()).message || 'Failed');
			toast.success('Marked as filled! Accountability works.');
			showFilledForm = false;
			await invalidateAll();
		} catch (err: unknown) {
			toastError(err instanceof Error ? err.message : 'Something went wrong');
		} finally {
			submitting = false;
		}
	}

	function fmt(date: string | null) {
		if (!date) return null;
		return format(new Date(date), 'MMM d, yyyy');
	}

	function daysSince(date: string | null): number | null {
		if (!date) return null;
		return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
	}

	function streetViewUrl(lat: number, lng: number): string {
		return `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;
	}

	function share(address: string | null, lat: number, lng: number) {
		const loc = address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
		const text = `There's an unfilled pothole at ${loc} in the Waterloo Region — help get it on the map!`;
		if (navigator.share) {
			navigator.share({ title: 'fillthehole.ca', text, url: window.location.href });
		} else {
			navigator.clipboard.writeText(window.location.href);
			toast.success('Link copied!');
		}
	}


</script>

<svelte:head>
	<title>Pothole at {pothole.address || 'Unknown location'} — FillTheHole.ca</title>
	<meta name="description" content={ogDescription} />
	<meta property="og:title" content="Pothole at {pothole.address || 'Unknown location'} — FillTheHole.ca" />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:image" content="{origin}/api/og/{pothole.id}" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:url" content="{origin}/hole/{pothole.id}" />
	<meta property="og:type" content="website" />
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-8 space-y-6" inert={lightboxIndex !== null}>
	{#if submitted}
		<div class="bg-sky-950/40 border border-sky-800 rounded-xl p-5 space-y-3">
			<div class="flex items-start gap-3">
				<div class="shrink-0 p-2 rounded-lg bg-sky-500/10">
					<Icon name="check-circle" size={18} class="text-sky-400" />
				</div>
				<div class="space-y-1.5">
					<h2 class="text-base font-semibold text-white">Report received</h2>
					{#if pothole.status === 'pending'}
						<p class="text-sm text-zinc-300">
							Your report is saved and waiting for independent confirmation before it appears on the public map.
						</p>
						<p class="text-xs text-zinc-400 tabular-nums">
							Progress: {pothole.confirmed_count}/{confirmationThreshold} confirmation{confirmationThreshold === 1 ? '' : 's'}
						</p>
					{:else if pothole.status === 'reported'}
						<p class="text-sm text-zinc-300">
							This pothole is now live on the public map. Share the link or report it officially to help it get fixed faster.
						</p>
					{:else}
						<p class="text-sm text-zinc-300">
							Your report was received. This page will track what happens next.
						</p>
					{/if}
				</div>
			</div>
			<div class="flex flex-wrap gap-2">
				<a
					href={officialCityLink?.href ?? '/about'}
					target={officialCityLink ? '_blank' : undefined}
					rel={officialCityLink ? 'noopener noreferrer' : undefined}
					class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
				>
					<Icon name="external-link" size={13} class="shrink-0" />
					{officialCityLink ? `File with ${officialCityLink.label}` : 'Official reporting links'}
				</a>
				<button
					onclick={() => share(pothole.address, pothole.lat, pothole.lng)}
					class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
				>
					<Icon name="clipboard" size={13} class="shrink-0" />
					Copy link
				</button>
			</div>
		</div>
	{/if}

	<!-- Header -->
	<div>
		<div class="flex items-center justify-between mb-3">
			<a href={pothole.status === 'reported' ? `/?focus=${pothole.id}&lat=${pothole.lat}&lng=${pothole.lng}` : '/'} class="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
				<Icon name="arrow-left" size={14} />
				Back to map
			</a>
			{#if watchMounted}
				<button
					onclick={handleWatch}
					aria-pressed={watching}
					aria-label={watching ? 'Remove from watchlist' : 'Add to watchlist'}
					class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors
						{watching
							? 'bg-sky-900/40 border-sky-700 text-sky-400 hover:bg-sky-900/60'
							: 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'}"
				>
					<Icon name={watching ? 'bookmark-filled' : 'bookmark'} size={13} class="shrink-0" />
					{watching ? 'Watching' : 'Watch'}
				</button>
			{/if}
		</div>
		<h1 class="page-title text-2xl sm:text-3xl text-white">
			{pothole.address || `${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}
		</h1>
		<div class="flex items-center gap-2 mt-1.5">
			{#if info}
				<Icon name={info.icon} size={16} class={info.colorClass} />
				<span class="font-semibold {info.colorClass}">{info.label}</span>
			{/if}
			<span class="text-zinc-700">·</span>
			<span class="text-zinc-500 text-sm">Reported {fmt(pothole.created_at)}</span>
		</div>
	</div>

	<!-- Pending notice -->
	{#if pothole.status === 'pending'}
		<div class="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-center space-y-1.5">
			<p class="flex items-center justify-center gap-2 text-zinc-300 font-semibold">
				<Icon name="clock" size={16} class="text-zinc-400 shrink-0" />
				Awaiting confirmation
			</p>
			<p class="text-zinc-500 text-sm">
				This pothole needs independent reports from others physically at this location before
				it appears on the public map.
			</p>
			<p class="text-zinc-600 text-xs mt-2 tabular-nums">
				Confirmations: {pothole.confirmed_count}/{data.confirmationThreshold}
			</p>
		</div>
	{/if}

	<!-- Status pipeline -->
	{#if pothole.status !== 'pending' && pothole.status !== 'expired'}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
			<div class="flex items-center justify-between text-sm">
				{#each (['reported', 'filled'] as const) as s (s)}
					{@const cfg = STATUS_CONFIG[s]}
					{@const isCurrent = pothole.status === s}
					{@const isPast = s === 'reported' || pothole.status === 'filled'}
					<div class="flex flex-col items-center gap-1.5 flex-1">
						<div class="transition-colors {isPast ? cfg.colorClass : 'text-zinc-700'}">
							<Icon name={cfg.icon} size={22} />
						</div>
						<span class="text-xs {isCurrent ? 'text-white font-semibold' : isPast ? 'text-zinc-400' : 'text-zinc-600'}">{cfg.label}</span>
						{#if isCurrent}
							<div class="w-1.5 h-1.5 rounded-full bg-sky-500"></div>
						{/if}
					</div>
					{#if s !== 'filled'}
						<div class="flex-1 h-px bg-zinc-700 self-center mb-6 max-w-12"></div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<!-- "I hit this" signal -->
	{#if pothole.status === 'reported'}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
			<div class="flex items-center justify-between gap-3">
				<div class="space-y-0.5">
					<p class="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
						<Icon name="zap" size={14} class="text-orange-400 shrink-0" />
						Hit this pothole?
					</p>
					<p class="text-xs text-zinc-500">
						{hitCount === 0 ? 'No hits recorded yet.' : `${hitCount} driver${hitCount === 1 ? '' : 's'} hit this.`}
					</p>
				</div>
				<button
					onclick={recordHit}
					disabled={hitSubmitted || hittingIt}
					aria-label={hitSubmitted ? 'Hit already recorded' : 'Record that you hit this pothole'}
					class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors
						{hitSubmitted
							? 'bg-orange-900/30 border border-orange-800/60 text-orange-400 cursor-default'
							: 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-orange-600 hover:text-orange-400'}"
				>
					{#if hittingIt}
						<Icon name="loader" size={13} class="animate-spin shrink-0" />
					{:else}
						<Icon name="zap" size={13} class="shrink-0" />
					{/if}
					{hitSubmitted ? 'Recorded' : 'I hit this'}
				</button>
			</div>
		</div>
	{/if}

	<!-- Repeat pothole notice -->
	{#if nearbyFilled.length > 0}
		{@const mostRecent = nearbyFilled[0]}
		<div class="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4 space-y-1.5">
			<div class="flex items-center gap-2 text-sm font-semibold text-amber-400">
				<Icon name="alert-triangle" size={14} class="shrink-0" />
				Recurring road issue
			</div>
			<p class="text-xs text-zinc-400 leading-relaxed">
				A nearby pothole
				{#if mostRecent.address}
					at <span class="text-zinc-300">{mostRecent.address}</span>
				{/if}
				was previously filled on <span class="text-zinc-300">{format(new Date(mostRecent.filled_at), 'MMM d, yyyy')}</span>
				— this location may need a permanent repair.
			</p>
			<p class="text-xs text-zinc-600">
				{nearbyFilled.length === 1 ? '1 prior fill' : `${nearbyFilled.length} prior fills`} recorded within 110 m of this spot.
			</p>
		</div>
	{/if}

	{#if pothole.status !== 'filled'}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
				<Icon name="flag" size={14} class="text-sky-400 shrink-0" />
				Report it officially too
			</div>
			<p class="text-zinc-400 text-sm">
				This page creates public visibility. Reporting it to the road owner through official channels can help start their repair or claims process.
			</p>
			<div class="grid gap-2 sm:grid-cols-2">
				{#if officialCityLink}
					<a
						href={officialCityLink.href}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
					>
						<Icon name="external-link" size={13} class="shrink-0" />
						File with {officialCityLink.label}
					</a>
				{/if}
				<a
					href={REGION_REPORT_LINK.href}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
				>
					<Icon name="external-link" size={13} class="shrink-0" />
					Submit a claim — {REGION_REPORT_LINK.label}
				</a>
			</div>
			<div class="rounded-lg bg-zinc-800/80 p-3 text-xs text-zinc-400 leading-relaxed space-y-1.5">
				<p>
					Local residential streets usually belong to the city. Major roads like King, Weber, Victoria, and Erb are often Regional roads.
				</p>
				<p>
					Highways 401, 7/8, and 85 are provincial roads.
					<a
						href={MTO_REPORT_LINK.href}
						target="_blank"
						rel="noopener noreferrer"
						class="text-sky-400 underline underline-offset-2 hover:text-sky-300"
					>
						Report those to the Ontario Ministry of Transportation
					</a>.
				</p>
			</div>
		</div>
	{/if}

	<!-- Photos -->
	{#if photos.length > 0}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
				<Icon name="camera" size={14} class="text-sky-400 shrink-0" />
				{photos.length === 1 ? 'Photo' : 'Photos'}
			</div>
			<div class="grid grid-cols-2 gap-2">
				{#each photos as photo, i (photo.id)}
					<button
						onclick={() => openLightbox(i)}
						class="block rounded-lg overflow-hidden ring-1 ring-zinc-700 hover:ring-sky-500 transition-shadow cursor-zoom-in"
						aria-label="View photo {i + 1} of {photos.length}"
					>
						<img
							src={photo.thumbnailUrl}
							alt="Pothole at {pothole.address || 'this location'}"
							class="w-full object-cover aspect-video"
							loading="lazy"
							onerror={(e) => { (e.currentTarget as HTMLImageElement).src = photo.url; }}
						/>
					</button>
				{/each}
			</div>
		</div>
	{:else if canUploadPhoto}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
				<Icon name="camera" size={14} class="text-sky-400 shrink-0" />
				Photo
			</div>
			{#if photoPreview}
				<div class="relative">
					<img src={photoPreview} alt="Selected pothole preview" class="w-full rounded-lg object-cover aspect-video" />
					<button
						type="button"
						onclick={clearPhoto}
						aria-label="Remove photo"
						class="absolute top-2 right-2 bg-zinc-900/80 hover:bg-zinc-900 rounded-full p-1.5 text-zinc-400 hover:text-white transition-colors"
					>
						<Icon name="x" size={14} />
					</button>
				</div>
				<button
					onclick={uploadPhoto}
					disabled={uploadingPhoto}
					class="w-full py-2.5 bg-sky-700 hover:bg-sky-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5"
				>
					{#if uploadingPhoto}
						<Icon name="loader" size={13} class="animate-spin shrink-0" />
						Uploading…
					{:else}
						<Icon name="camera" size={13} class="shrink-0" />
						Submit photo
					{/if}
				</button>
			{:else}
				<button
					type="button"
					onclick={() => photoInput?.click()}
					class="w-full py-3 rounded-lg border-2 border-dashed border-zinc-700 hover:border-sky-500 hover:bg-sky-500/5 text-zinc-400 hover:text-sky-400 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
				>
					<Icon name="camera" size={15} class="shrink-0" />
					Add a photo
				</button>
			{/if}
			<input
				bind:this={photoInput}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
				aria-label="Upload a pothole photo"
				onchange={handlePhotoSelect}
			/>
			<p class="text-xs text-zinc-500">Photos are reviewed before appearing publicly. Only snap one if you're safely off the road.</p>
		</div>
	{/if}

	<!-- Info -->
	{#if pothole.description || pothole.filled_at}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
			{#if pothole.description}
				<p class="text-zinc-300 italic">"{pothole.description}"</p>
			{/if}
			{#if pothole.filled_at}
				<p class="text-zinc-500">Filled on <span class="text-zinc-300">{fmt(pothole.filled_at)}</span></p>
			{/if}
		</div>
	{/if}

	<!-- Mark as filled action -->
	{#if pothole.status === 'reported'}
		{#if !showFilledForm}
			<button
				onclick={() => (showFilledForm = true)}
				class="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
			>
				<Icon name="check-circle" size={16} class="shrink-0" />
				Mark as filled
			</button>
		{:else}
			<div class="bg-zinc-900 border border-green-800 rounded-xl p-4 space-y-3">
				<h3 class="flex items-center gap-2 font-semibold text-green-400">
					<Icon name="check-circle" size={15} class="shrink-0" />
					It's been filled!
				</h3>
				<p class="text-zinc-400 text-sm">Confirm the city has patched this one up.</p>
				<div class="flex gap-2">
					<button
						onclick={() => (showFilledForm = false)}
						class="flex-1 py-2 border border-zinc-700 text-zinc-400 rounded-lg text-sm hover:border-zinc-500 transition-colors"
					>Cancel</button>
					<button
						onclick={markFilled}
						disabled={submitting}
						class="flex-1 py-2 bg-green-700 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5"
					>
						{#if submitting}
							<Icon name="loader" size={13} class="animate-spin shrink-0" />
							Saving…
						{:else}
							<Icon name="check-circle" size={13} class="shrink-0" />
							Confirm filled
						{/if}
					</button>
				</div>
			</div>
		{/if}
	{/if}

	{#if pothole.status === 'filled'}
		<div class="bg-green-900/20 border border-green-800/60 rounded-xl p-5 text-center">
			<div class="flex justify-center mb-3">
				<Icon name="check-circle" size={36} class="text-green-400" />
			</div>
			<p class="text-green-300 font-semibold">This pothole has been filled!</p>
			<p class="text-zinc-400 text-sm mt-1">The city responded. Accountability worked.</p>
		</div>
	{/if}

	<!-- Expired state -->
	{#if pothole.status === 'expired'}
		<div class="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-center space-y-1">
			<div class="flex justify-center mb-2">
				<Icon name="clock" size={36} class="text-zinc-500" />
			</div>
			<p class="text-zinc-300 font-semibold">This report has expired</p>
			<p class="text-zinc-500 text-sm mt-1">
				No activity for 3+ months. The pothole may have been filled — or may still be there.
			</p>
		</div>
	{/if}

	<!-- Days since reported -->
	{#if pothole.status === 'reported'}
		{@const days = daysSince(pothole.created_at)}
		{#if days !== null && days > 0}
			<p class="text-center text-zinc-500 text-sm">
				Reported <span class="text-orange-400 font-semibold tabular-nums">{days} day{days === 1 ? '' : 's'} ago</span> — still unfilled.
			</p>
		{/if}
	{/if}

	<!-- City repair requests (Kitchener CCC data) -->
	{#if cityRepairRequests.length > 0}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
				<Icon name="flag" size={14} class="text-sky-400 shrink-0" />
				City repair {cityRepairRequests.length === 1 ? 'request' : 'requests'} on file
			</div>
			<p class="text-zinc-400 text-sm">
				Kitchener's 311 system has
				<span class="text-white font-semibold">{cityRepairRequests.length} official pothole repair {cityRepairRequests.length === 1 ? 'request' : 'requests'}</span>
				logged within 200 m of this location.
			</p>
			<ul class="space-y-1.5">
				{#each cityRepairRequests as req (req.date + req.intersection)}
					<li class="flex items-start gap-2 text-xs text-zinc-400">
						<Icon name="clock" size={12} class="text-zinc-600 shrink-0 mt-0.5" />
						<span>
							<span class="text-zinc-300">{req.intersection}</span>
							<span class="text-zinc-600 ml-1.5 tabular-nums">{fmt(req.date)}</span>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Councillor contact -->
	{#if councillor && pothole.status !== 'filled'}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
			<div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
				<Icon name="mail" size={14} class="text-sky-400 shrink-0" />
				Contact your councillor
			</div>
			<p class="text-zinc-400 text-sm">
				{councillor.city.charAt(0).toUpperCase() + councillor.city.slice(1)}, Ward {councillor.ward} — <span class="text-white">{councillor.name}</span>
			</p>
			<div class="flex flex-wrap gap-2">
				<a
					href={getPotholeEmailUrl(councillor, pothole)}
					class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
				>
					<Icon name="mail" size={13} class="shrink-0" />
					Email {councillor.name.split(' ')[0]}
				</a>
				<a
					href={councillor.url}
					target="_blank"
					rel="noopener noreferrer"
					class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
				>
					<Icon name="external-link" size={13} class="shrink-0" />
					Councillor page
				</a>
			</div>
		</div>
	{/if}

	<!-- Links -->
	<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
		<div class="flex items-center gap-2 text-sm font-semibold text-zinc-300">
			<Icon name="share-2" size={14} class="text-zinc-400 shrink-0" />
			Share & links
		</div>
		<div class="flex flex-wrap gap-2">
			<a
				href={streetViewUrl(pothole.lat, pothole.lng)}
				target="_blank"
				rel="noopener noreferrer"
				class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
			>
				<Icon name="map" size={13} class="shrink-0" />
				Street View
			</a>
			<button
				onclick={() => share(pothole.address, pothole.lat, pothole.lng)}
				class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
			>
				<Icon name="clipboard" size={13} class="shrink-0" />
				Copy link
			</button>
		</div>
	</div>
</div>

<!-- Lightbox -->
{#if lightboxIndex !== null}
	<div
		bind:this={lightboxDialogEl}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
		role="dialog"
		aria-modal="true"
		aria-label="Photo viewer"
		tabindex="-1"
		onclick={closeLightbox}
		onkeydown={(e) => { if (e.key === 'Escape') closeLightbox(); }}
	>
		<!-- Close -->
		<button
			bind:this={lightboxCloseBtn}
			onclick={(e) => { e.stopPropagation(); closeLightbox(); }}
			aria-label="Close photo viewer"
			class="absolute top-4 right-4 p-2 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-10"
		>
			<Icon name="x" size={20} />
		</button>

		<!-- Prev -->
		{#if photos.length > 1}
			<button
				onclick={(e) => { e.stopPropagation(); prevPhoto(); }}
				aria-label="Previous photo"
				class="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-10"
			>
				<Icon name="arrow-left" size={20} />
			</button>
		{/if}

		<!-- Image — render current + ±1 adjacent so prev/next navigate instantly -->
		<div role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			{#each photos as photo, i (photo.id)}
				{#if Math.abs(i - lightboxIndex) <= 1}
					<img
						src={photo.url}
						alt="Pothole at {pothole.address || 'this location'} — photo {i + 1} of {photos.length}"
						class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
						class:hidden={i !== lightboxIndex}
						aria-hidden={i !== lightboxIndex}
					/>
				{/if}
			{/each}
		</div>

		<!-- Next -->
		{#if photos.length > 1}
			<button
				onclick={(e) => { e.stopPropagation(); nextPhoto(); }}
				aria-label="Next photo"
				class="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-10"
			>
				<Icon name="arrow-right" size={20} />
			</button>

			<!-- Dots -->
			<div
				role="presentation"
				class="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
			>
				{#each photos as photo, i (photo.id)}
					<button
						onclick={() => (lightboxIndex = i)}
						aria-label="Go to photo {i + 1}"
						class="w-1.5 h-1.5 rounded-full transition-colors {i === lightboxIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/60'}"
					></button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
