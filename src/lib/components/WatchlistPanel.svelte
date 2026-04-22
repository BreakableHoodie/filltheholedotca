<script lang="ts">
	import { onMount } from 'svelte';
	import { STATUS_CONFIG } from '$lib/constants';
	import Icon from '$lib/components/Icon.svelte';
	import { getWatchlist, removeWatch } from '$lib/watchlist';

	type WatchedPothole = {
		id: string;
		address: string | null;
		lat: number;
		lng: number;
		status: string;
		created_at: string;
		filled_at: string | null;
		photos_published: boolean;
	};

	const PAGE_SIZE = 6;

	let { count = $bindable(0) }: { count?: number } = $props();

	let ids = $state<string[]>([]);
	let potholes = $state<WatchedPothole[]>([]);
	let loading = $state(false);
	let fetchError = $state(false);
	let showAll = $state(false);
	let visiblePotholes = $derived(showAll ? potholes : potholes.slice(0, PAGE_SIZE));

	// Keep the bound count in sync whenever ids changes
	$effect(() => {
		count = ids.length;
	});

	function daysSince(date: string): number {
		return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
	}

	function daysLabel(pothole: WatchedPothole): string {
		if (pothole.status === 'filled' && pothole.filled_at) {
			const d = Math.floor(
				(new Date(pothole.filled_at).getTime() - new Date(pothole.created_at).getTime()) /
					86_400_000
			);
			return d === 0 ? 'Filled same day' : `Filled in ${d}d`;
		}
		const d = daysSince(pothole.created_at);
		return d === 0 ? 'Reported today' : `${d}d unfilled`;
	}

	function unwatch(id: string) {
		removeWatch(id);
		potholes = potholes.filter((p) => p.id !== id);
		ids = ids.filter((i) => i !== id);
	}

	onMount(async () => {
		ids = getWatchlist();
		if (ids.length === 0) return;

		loading = true;
		fetchError = false;
		try {
			const res = await fetch(`/api/watchlist?ids=${ids.join(',')}`);
			if (!res.ok) {
				fetchError = true;
				return;
			}
			const data: WatchedPothole[] = await res.json();
			// Preserve the user's watch order from localStorage
			const byId = new Map(data.map((p) => [p.id, p]));
			potholes = ids.map((id) => byId.get(id)).filter((p): p is WatchedPothole => p != null);
		} catch {
			fetchError = true;
		} finally {
			loading = false;
		}
	});
</script>

{#if ids.length > 0}
	<section aria-labelledby="watchlist-heading" class="bg-zinc-950 border-t border-zinc-800">
		<div class="max-w-6xl mx-auto px-4 py-8">
			<div class="flex items-center gap-2 mb-5">
				<Icon name="bookmark-filled" size={15} class="text-sky-400 shrink-0" />
				<h2 id="watchlist-heading" class="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
					My Watchlist
				</h2>
				<span class="text-zinc-600 text-xs tabular-nums ml-1">({ids.length})</span>
			</div>

			{#if loading}
				<!-- Skeleton cards — match expected layout to prevent CLS -->
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each { length: Math.min(ids.length, PAGE_SIZE) } as _}
						<div class="relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 h-[100px] animate-pulse">
							<div class="absolute inset-y-0 left-0 w-[3px] bg-zinc-700"></div>
							<div class="pl-5 pr-3 pt-3.5 pb-3.5 flex flex-col gap-2.5">
								<div class="h-4 bg-zinc-700 rounded w-3/4"></div>
								<div class="h-3 bg-zinc-800 rounded w-1/2"></div>
								<div class="h-3 bg-zinc-800 rounded w-1/3"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if fetchError}
				<p class="text-zinc-500 text-sm">Couldn't load watchlist status. Try refreshing.</p>
			{:else if potholes.length > 0}
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each visiblePotholes as pothole (pothole.id)}
						{@const info =
							STATUS_CONFIG[pothole.status as keyof typeof STATUS_CONFIG] ??
							STATUS_CONFIG.reported}
						{@const accentColor =
							pothole.status === 'reported' ? 'bg-orange-500' :
							pothole.status === 'filled'   ? 'bg-green-500' :
							pothole.status === 'expired'  ? 'bg-zinc-600' : 'bg-zinc-700'}
						{@const pillColor =
							pothole.status === 'reported' ? 'bg-orange-500/10 text-orange-400' :
							pothole.status === 'filled'   ? 'bg-green-500/10 text-green-400' :
							'bg-zinc-700/60 text-zinc-500'}
						<div class="relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors">
							<!-- Status accent strip -->
							<div class="absolute inset-y-0 left-0 w-[3px] {accentColor}"></div>

							<div class="pl-5 pr-3 pt-3.5 pb-3.5 flex flex-col gap-2.5">
								<!-- Address + remove -->
								<div class="flex items-start justify-between gap-2">
									<a
										href="/hole/{pothole.id}"
										class="flex-1 text-sm font-semibold text-white hover:text-sky-400 transition-colors leading-snug line-clamp-2"
									>
										{pothole.address || `${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}
									</a>
									<button
										onclick={() => unwatch(pothole.id)}
										class="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors p-1 -mr-1 rounded-md hover:bg-zinc-800"
										aria-label="Remove {pothole.address || 'this pothole'} from watchlist"
										title="Remove from watchlist"
									>
										<Icon name="x" size={13} />
									</button>
								</div>

								<!-- Status pill + age -->
								<div class="flex items-center justify-between gap-2">
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold {pillColor}">
										<Icon name={info.icon} size={11} />
										{info.label}
									</span>
									<span class="text-xs text-zinc-600 tabular-nums shrink-0">{daysLabel(pothole)}</span>
								</div>

								<!-- Footer: view link + photo badge -->
								<div class="flex items-center justify-between gap-2 pt-0.5">
									<a
										href="/hole/{pothole.id}"
										class="text-xs font-medium text-zinc-500 hover:text-sky-400 transition-colors"
										aria-label="View details for {pothole.address || 'this pothole'}"
									>
										View details →
									</a>
									{#if pothole.photos_published}
										<span class="inline-flex items-center gap-1 text-[11px] text-zinc-600">
											<Icon name="camera" size={11} />
											Photo
										</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
				{#if potholes.length > PAGE_SIZE}
					<div class="mt-4 text-center">
						<button
							type="button"
							onclick={() => (showAll = !showAll)}
							class="text-xs font-medium text-zinc-500 hover:text-sky-400 transition-colors"
						>
							{showAll ? 'Show fewer' : `Show ${potholes.length - PAGE_SIZE} more`}
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</section>
{/if}
