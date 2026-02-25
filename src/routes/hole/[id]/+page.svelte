<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { format } from 'date-fns';
	import { STATUS_CONFIG } from '$lib/constants';
	import Icon from '$lib/components/Icon.svelte';
	import type { PageData } from './$types';
	import type { Pothole, PotholeStatus } from '$lib/types';
	import type { Councillor } from '$lib/wards';

	let { data }: { data: PageData } = $props();
	let pothole = $derived(data.pothole as Pothole);
	let info = $derived(STATUS_CONFIG[pothole.status]);
	let councillor = $derived(data.councillor as Councillor | null);

	let submitting = $state(false);
	let showFlagForm = $state(false);
	let showFilledForm = $state(false);

	async function flagPothole() {
		submitting = true;
		try {
			const res = await fetch('/api/wanksy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: pothole.id })
			});
			if (!res.ok) throw new Error((await res.json()).message || 'Failed');
			toast.success('Flagged! The city has been put on notice.');
			showFlagForm = false;
			await invalidateAll();
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'Something went wrong');
		} finally {
			submitting = false;
		}
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
			toast.error(err instanceof Error ? err.message : 'Something went wrong');
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

	function tweetUrl(address: string | null, lat: number, lng: number, id: string): string {
		const loc = address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
		const text = `There's an unfilled pothole at ${loc} in the Waterloo Region. Help get it filled! fillthehole.ca/hole/${id}`;
		return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
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

	function getEmailUrl(councillor: Councillor, pothole: Pothole) {
		const subject = `Pothole at ${pothole.address || 'my location'}`;
		const body = `Hi ${councillor.name},

I'd like to report an unfilled pothole in Ward ${councillor.ward}.

Location: ${pothole.address || `${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}
Tracked at: https://fillthehole.ca/hole/${pothole.id}

This pothole has been reported and is awaiting city action. Please help get it on the city's radar.

Thank you.`;
		return `mailto:${councillor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
	}
</script>

<svelte:head>
	<title>Pothole at {pothole.address || 'Unknown location'} — fillthehole.ca</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-8 space-y-6">
	<!-- Header -->
	<div>
		<a href="/" class="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm mb-3 transition-colors">
			<Icon name="arrow-left" size={14} />
			Back to map
		</a>
		<h1 class="text-2xl font-bold text-white">
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
				Confirmations: {pothole.confirmed_count}/3
			</p>
		</div>
	{/if}

	<!-- Status pipeline -->
	{#if pothole.status !== 'pending'}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
			<div class="flex items-center justify-between text-sm">
				{#each ['reported', 'wanksyd', 'filled'] as s (s)}
					{@const status = s as PotholeStatus}
					{@const cfg = STATUS_CONFIG[status]}
					{@const isCurrent = pothole.status === status}
					{@const isPast = status === 'reported' || (status === 'wanksyd' && pothole.status !== 'reported') || (status === 'filled' && pothole.status === 'filled')}
					<div class="flex flex-col items-center gap-1.5 flex-1">
						<div class="transition-colors {isPast ? cfg.colorClass : 'text-zinc-700'}">
							<Icon name={cfg.icon} size={22} />
						</div>
						<span class="text-xs {isCurrent ? 'text-white font-semibold' : isPast ? 'text-zinc-400' : 'text-zinc-600'}">{cfg.label}</span>
						{#if isCurrent}
							<div class="w-1.5 h-1.5 rounded-full bg-sky-500"></div>
						{/if}
					</div>
					{#if status !== 'filled'}
						<div class="flex-1 h-px bg-zinc-700 self-center mb-6 max-w-12"></div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<!-- Info -->
	{#if pothole.description || pothole.wanksy_at || pothole.filled_at}
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
			{#if pothole.description}
				<p class="text-zinc-300 italic">"{pothole.description}"</p>
			{/if}
			{#if pothole.wanksy_at}
				<p class="text-zinc-500">Flagged on <span class="text-zinc-300">{fmt(pothole.wanksy_at)}</span></p>
			{/if}
			{#if pothole.filled_at}
				<p class="text-zinc-500">Filled on <span class="text-zinc-300">{fmt(pothole.filled_at)}</span></p>
			{/if}
		</div>
	{/if}

	<!-- Flag action -->
	{#if pothole.status === 'reported'}
		{#if !showFlagForm}
			<button
				onclick={() => (showFlagForm = true)}
				class="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
			>
				<Icon name="flag" size={16} class="shrink-0" />
				I flagged this one
			</button>
		{:else}
			<div class="bg-zinc-900 border border-sky-800 rounded-xl p-4 space-y-3">
				<h3 class="flex items-center gap-2 font-semibold text-sky-400">
					<Icon name="flag" size={15} class="shrink-0" />
					Flag this pothole
				</h3>
				<p class="text-zinc-400 text-sm">
					Go to this location, verify the pothole is still there, and submit an official report
					through the city's service request system. Then come back and mark it flagged here.
				</p>
				<div class="flex gap-2">
					<button
						onclick={() => (showFlagForm = false)}
						class="flex-1 py-2 border border-zinc-700 text-zinc-400 rounded-lg text-sm hover:border-zinc-500 transition-colors"
					>Cancel</button>
					<button
						onclick={flagPothole}
						disabled={submitting}
						class="flex-1 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5"
					>
						{#if submitting}
							<Icon name="loader" size={13} class="animate-spin shrink-0" />
							Saving…
						{:else}
							<Icon name="flag" size={13} class="shrink-0" />
							Mark as flagged
						{/if}
					</button>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Filled action -->
	{#if pothole.status === 'wanksyd'}
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

	<!-- Days since reported -->
	{#if pothole.status !== 'filled' && pothole.status !== 'pending'}
		{@const days = daysSince(pothole.created_at)}
		{#if days !== null && days > 0}
			<p class="text-center text-zinc-500 text-sm">
				Reported <span class="text-orange-400 font-semibold tabular-nums">{days} day{days === 1 ? '' : 's'} ago</span> — still unfilled.
			</p>
		{/if}
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
					href={getEmailUrl(councillor, pothole)}
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
			<a
				href={tweetUrl(pothole.address, pothole.lat, pothole.lng, pothole.id)}
				target="_blank"
				rel="noopener noreferrer"
				class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
			>
				<Icon name="x-twitter" size={13} class="shrink-0" />
				Share on X
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
