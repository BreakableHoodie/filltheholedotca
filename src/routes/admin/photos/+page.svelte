<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { SvelteSet } from 'svelte/reactivity';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let selected = $state(new SvelteSet<string>());
	let bulkFormEl: HTMLFormElement | undefined = $state();

	const allSelected = $derived(
		data.photos.length > 0 && selected.size === data.photos.length
	);
	const someSelected = $derived(selected.size > 0);

	function toggleSelect(id: string) {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}

	function toggleAll() {
		if (allSelected) selected.clear();
		else data.photos.forEach((p) => selected.add(p.id));
	}

	function scoreColor(score: number | null): string {
		if (score === null) return 'text-zinc-500 bg-zinc-800';
		if (score < 0.3) return 'text-emerald-400 bg-emerald-500/10';
		if (score < 0.7) return 'text-amber-400 bg-amber-500/10';
		return 'text-red-400 bg-red-500/10';
	}

	function scoreLabel(score: number | null): string {
		if (score === null) return 'unscored';
		if (score < 0.3) return `${Math.round(score * 100)}% — clean`;
		if (score < 0.7) return `${Math.round(score * 100)}% — review`;
		return `${Math.round(score * 100)}% — flag`;
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'reported':
				return 'text-sky-400 bg-sky-500/10';
			case 'filled':
				return 'text-emerald-400 bg-emerald-500/10';
			case 'expired':
				return 'text-amber-400 bg-amber-500/10';
			default:
				return 'text-zinc-400 bg-zinc-700/50';
		}
	}
</script>

<svelte:head>
	<title>Photo Review — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-xl font-semibold text-zinc-100">Photo Review</h1>
			<p class="text-zinc-500 text-sm mt-0.5">
				{#if data.photos.length === 0}
					No photos awaiting review
				{:else}
					{data.photos.length} photo{data.photos.length !== 1 ? 's' : ''} awaiting review
				{/if}
			</p>
		</div>
	</div>

	{#if data.photos.length === 0}
		<!-- Empty state -->
		<div class="text-center py-20">
			<div class="text-4xl mb-3">📷</div>
			<p class="text-zinc-400 font-medium">All caught up</p>
			<p class="text-zinc-600 text-sm mt-1">No photos are waiting for moderation.</p>
		</div>
	{:else}
		<!-- Bulk action toolbar -->
		<div
			class="flex items-center gap-3 mb-5 p-3 bg-zinc-900 border border-zinc-800 rounded-lg sticky top-4 z-10"
		>
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					checked={allSelected}
					onchange={toggleAll}
					class="rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-sky-500 focus:ring-offset-zinc-900 focus:ring-1"
				/>
				<span class="text-sm text-zinc-400">
					{#if someSelected}
						{selected.size} selected
					{:else}
						Select all
					{/if}
				</span>
			</label>

			<!-- Bulk form — populated reactively with selected IDs -->
			<form id="bulk-form" method="post" bind:this={bulkFormEl}>
				{#each [...selected] as id (id)}
					<input type="hidden" name="ids" value={id} />
				{/each}
			</form>

			<button
				type="submit"
				form="bulk-form"
				formaction="?/bulkApprove"
				disabled={!someSelected}
				class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors
				       {someSelected
					? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-600/30'
					: 'text-zinc-600 cursor-not-allowed border border-zinc-800'}"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
				</svg>
				Approve {someSelected ? `(${selected.size})` : ''}
			</button>

			<button
				type="submit"
				form="bulk-form"
				formaction="?/bulkReject"
				disabled={!someSelected}
				class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors
				       {someSelected
					? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30'
					: 'text-zinc-600 cursor-not-allowed border border-zinc-800'}"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
				</svg>
				Reject {someSelected ? `(${selected.size})` : ''}
			</button>
		</div>

		<!-- Photo grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.photos as photo (photo.id)}
				{@const pothole = photo.potholes}
				<div
					class="bg-zinc-900 border rounded-lg overflow-hidden transition-colors
					       {selected.has(photo.id) ? 'border-sky-500/50' : 'border-zinc-800'}"
				>
					<!-- Thumbnail -->
					<div class="relative">
						<button
							type="button"
							onclick={() => toggleSelect(photo.id)}
							class="absolute top-2 left-2 z-10"
							aria-label="Select photo"
						>
							<input
								type="checkbox"
								checked={selected.has(photo.id)}
								onchange={() => toggleSelect(photo.id)}
								class="rounded border-zinc-500 bg-zinc-800/80 text-sky-500 focus:ring-sky-500 focus:ring-1"
								onclick={(e) => e.stopPropagation()}
							/>
						</button>

						{#if photo.url}
							<a href={photo.url} target="_blank" rel="noopener noreferrer">
								<img
									src={photo.url}
									alt={pothole?.address ?? 'Pothole photo'}
									loading="lazy"
									class="w-full h-48 object-cover bg-zinc-800"
								/>
							</a>
						{:else}
							<div class="w-full h-48 bg-zinc-800 flex items-center justify-center text-zinc-600 text-sm">
								Image unavailable
							</div>
						{/if}
					</div>

					<!-- Info -->
					<div class="p-3">
						<p class="text-sm text-zinc-200 truncate font-medium" title={pothole?.address ?? ''}>
							{pothole?.address ?? 'Unknown address'}
						</p>

						<div class="flex items-center gap-2 mt-1.5">
							{#if pothole}
								<span
									class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium capitalize {statusColor(pothole.status)}"
								>
									{pothole.status}
								</span>
								<span class="text-zinc-600 text-xs">·</span>
								<span class="text-zinc-500 text-xs">{pothole.confirmed_count} confirmation{pothole.confirmed_count !== 1 ? 's' : ''}</span>
							{/if}
						</div>

						<div class="flex items-center justify-between mt-1.5">
							<span
								class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {scoreColor(photo.moderation_score)}"
							>
								{scoreLabel(photo.moderation_score)}
							</span>
							<span class="text-zinc-600 text-xs">
								{formatDistanceToNow(new Date(photo.created_at), { addSuffix: true })}
							</span>
						</div>

						<!-- Per-card actions -->
						<div class="flex gap-2 mt-3">
							<form method="post" action="?/approve" use:enhance class="flex-1">
								<input type="hidden" name="id" value={photo.id} />
								<button
									type="submit"
									class="w-full py-1.5 text-xs font-medium rounded border border-emerald-700/50 text-emerald-400 hover:bg-emerald-600/15 transition-colors"
								>
									Approve
								</button>
							</form>
							<form method="post" action="?/reject" use:enhance class="flex-1">
								<input type="hidden" name="id" value={photo.id} />
								<button
									type="submit"
									class="w-full py-1.5 text-xs font-medium rounded border border-red-700/50 text-red-400 hover:bg-red-600/15 transition-colors"
								>
									Reject
								</button>
							</form>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
