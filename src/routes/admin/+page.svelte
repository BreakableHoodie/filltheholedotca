<script lang="ts">
	import type { PageData } from './$types';
	import type { RecentEntry } from './+page.server.ts';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	function actionBadgeClass(action: string): string {
		if (/delete|deactivate|disable|revoke|reject/.test(action))
			return 'text-red-400 bg-red-500/10 border border-red-500/20';
		if (/update|change|override|edit|reset|regen/.test(action))
			return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
		if (/approve|activate|enable|confirm|create|login/.test(action))
			return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
		return 'text-sky-400 bg-sky-500/10 border border-sky-500/20';
	}

	function actorLabel(entry: RecentEntry): string {
		if (!entry.admin_users) return 'System';
		return `${entry.admin_users.first_name} ${entry.admin_users.last_name}`;
	}
</script>

<svelte:head>
	<title>Dashboard — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6 max-w-4xl">
	<h1 class="text-xl font-semibold text-zinc-100 mb-6">Dashboard</h1>

	<!-- ─── Stat cards ─── -->
	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
		<!-- Pending photos — actionable if > 0 -->
		<a
			href="/admin/photos"
			class="bg-zinc-900 border {data.counts.pendingPhotos > 0 ? 'border-amber-600/40 hover:border-amber-500/60' : 'border-zinc-800 hover:border-zinc-700'} rounded-lg p-4 transition-colors group"
		>
			<p class="text-xs text-zinc-500 mb-1 group-hover:text-zinc-400 transition-colors">
				Photos pending
			</p>
			<p class="text-2xl font-semibold {data.counts.pendingPhotos > 0 ? 'text-amber-400' : 'text-zinc-300'}">
				{data.counts.pendingPhotos}
			</p>
		</a>

		<!-- Pending potholes -->
		<a
			href="/admin/potholes?status=pending"
			class="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 transition-colors group"
		>
			<p class="text-xs text-zinc-500 mb-1 group-hover:text-zinc-400 transition-colors">
				Potholes pending
			</p>
			<p class="text-2xl font-semibold text-zinc-300">{data.counts.pendingPotholes}</p>
		</a>

		<!-- Reported (live) potholes -->
		<a
			href="/admin/potholes?status=reported"
			class="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 transition-colors group"
		>
			<p class="text-xs text-zinc-500 mb-1 group-hover:text-zinc-400 transition-colors">
				Reported (live)
			</p>
			<p class="text-2xl font-semibold text-sky-400">{data.counts.reportedPotholes}</p>
		</a>

		<!-- Filled potholes -->
		<a
			href="/admin/potholes?status=filled"
			class="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 transition-colors group"
		>
			<p class="text-xs text-zinc-500 mb-1 group-hover:text-zinc-400 transition-colors">
				Filled
			</p>
			<p class="text-2xl font-semibold text-emerald-400">{data.counts.filledPotholes}</p>
		</a>

		<!-- Expired potholes -->
		<a
			href="/admin/potholes?status=expired"
			class="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 transition-colors group"
		>
			<p class="text-xs text-zinc-500 mb-1 group-hover:text-zinc-400 transition-colors">
				Expired
			</p>
			<p class="text-2xl font-semibold text-zinc-500">{data.counts.expiredPotholes}</p>
		</a>
	</div>

	<!-- ─── Recent audit activity ─── -->
	<div class="bg-zinc-900 border border-zinc-800 rounded-lg">
		<div class="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
			<h2 class="text-sm font-medium text-zinc-300">Recent activity</h2>
			<a href="/admin/audit" class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
				View all →
			</a>
		</div>

		<div class="divide-y divide-zinc-800">
			{#each data.recentAudit as entry (entry.id)}
				<div class="px-4 py-3 flex items-start gap-3">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono {actionBadgeClass(entry.action)}">
								{entry.action}
							</span>
							{#if entry.resource_type}
								<span class="text-zinc-500 text-xs capitalize">{entry.resource_type}</span>
								{#if entry.resource_type === 'pothole' && entry.resource_id}
									<a
										href="/admin/potholes/{entry.resource_id}"
										class="text-sky-500 text-xs font-mono hover:text-sky-400 transition-colors"
									>
										{entry.resource_id.slice(0, 8)}…
									</a>
								{/if}
							{/if}
						</div>
						<p class="text-zinc-600 text-xs mt-1">
							{actorLabel(entry)}
							·
							{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
						</p>
					</div>
				</div>
			{:else}
				<div class="px-4 py-8 text-center text-zinc-600 text-sm">No activity yet.</div>
			{/each}
		</div>
	</div>
</div>
