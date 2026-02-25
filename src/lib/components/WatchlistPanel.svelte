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
	};

	let ids = $state<string[]>([]);
	let potholes = $state<WatchedPothole[]>([]);
	let loading = $state(false);
	let fetchError = $state(false);

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
				<div class="flex items-center gap-2 text-zinc-500 text-sm py-2">
					<Icon name="loader" size={14} class="animate-spin shrink-0" />
					Loading…
				</div>
			{:else if fetchError}
				<p class="text-zinc-500 text-sm">Couldn't load watchlist status. Try refreshing.</p>
			{:else if potholes.length > 0}
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each potholes as pothole (pothole.id)}
						{@const info =
							STATUS_CONFIG[pothole.status as keyof typeof STATUS_CONFIG] ??
							STATUS_CONFIG.reported}
						<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
							<!-- Address + remove -->
							<div class="flex items-start justify-between gap-2">
								<a
									href="/hole/{pothole.id}"
									class="text-sm font-semibold text-white hover:text-sky-400 transition-colors leading-snug line-clamp-2 flex-1"
								>
									{pothole.address ||
										`${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}
								</a>
								<button
									onclick={() => unwatch(pothole.id)}
									class="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-800"
									aria-label="Remove {pothole.address || 'this pothole'} from watchlist"
									title="Remove from watchlist"
								>
									<Icon name="x" size={13} />
								</button>
							</div>

							<!-- Status + days -->
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-1.5">
									<Icon name={info.icon} size={13} class={info.colorClass} />
									<span class="text-xs font-semibold {info.colorClass}">{info.label}</span>
								</div>
								<span class="text-xs text-zinc-600 tabular-nums">{daysLabel(pothole)}</span>
							</div>

							<!-- View link -->
							<a
								href="/hole/{pothole.id}"
								class="text-xs text-sky-500 hover:text-sky-400 transition-colors font-medium"
								aria-label="View details for {pothole.address || 'this pothole'}"
							>
								View details →
							</a>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</section>
{/if}
