<script lang="ts">
	import type { PageData } from './$types';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	type Tab = { label: string; value: string | null; count?: number };

	const statusTabs: Tab[] = [
		{ label: 'All', value: null },
		{ label: 'Pending', value: 'pending' },
		{ label: 'Reported', value: 'reported' },
		{ label: 'Filled', value: 'filled' },
		{ label: 'Expired', value: 'expired' }
	];

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

	function tabHref(value: string | null): string {
		return value ? `/admin/potholes?status=${value}` : '/admin/potholes';
	}

	function isActiveTab(value: string | null): boolean {
		return data.filterStatus === value;
	}
</script>

<svelte:head>
	<title>Potholes — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-xl font-semibold text-zinc-100">Potholes</h1>
		<p class="text-zinc-500 text-sm mt-0.5">
			{data.potholes.length} pothole{data.potholes.length !== 1 ? 's' : ''}
			{data.filterStatus ? `with status "${data.filterStatus}"` : 'total'}
		</p>
	</div>

	<!-- Status filter tabs -->
	<div class="flex gap-1 mb-5 border-b border-zinc-800">
		{#each statusTabs as tab}
			<a
				href={tabHref(tab.value)}
				class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px
				       {isActiveTab(tab.value)
					? 'border-sky-500 text-sky-400'
					: 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'}"
			>
				{tab.label}
			</a>
		{/each}
	</div>

	{#if data.potholes.length === 0}
		<div class="text-center py-20">
			<div class="text-4xl mb-3">🕳️</div>
			<p class="text-zinc-400 font-medium">No potholes found</p>
			<p class="text-zinc-600 text-sm mt-1">
				{data.filterStatus ? `No potholes with status "${data.filterStatus}".` : 'The database is empty.'}
			</p>
		</div>
	{:else}
		<div class="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-zinc-800 text-left">
						<th class="px-4 py-3 text-zinc-500 font-medium">Address</th>
						<th class="px-4 py-3 text-zinc-500 font-medium">Status</th>
						<th class="px-4 py-3 text-zinc-500 font-medium">Confirmations</th>
						<th class="px-4 py-3 text-zinc-500 font-medium">Coordinates</th>
						<th class="px-4 py-3 text-zinc-500 font-medium">Reported</th>
						<th class="px-4 py-3 text-zinc-500 font-medium sr-only">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-800">
					{#each data.potholes as pothole (pothole.id)}
						<tr class="hover:bg-zinc-800/40 transition-colors">
							<td class="px-4 py-3 max-w-xs">
								<p class="text-zinc-200 truncate" title={pothole.address ?? ''}>
									{pothole.address ?? 'No address'}
								</p>
								<p class="text-zinc-600 text-xs mt-0.5 font-mono">
									{pothole.id.slice(0, 8)}…
								</p>
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize {statusColor(pothole.status)}"
								>
									{pothole.status}
								</span>
							</td>
							<td class="px-4 py-3 text-zinc-400 tabular-nums">
								{pothole.confirmed_count}
							</td>
							<td class="px-4 py-3 text-zinc-500 text-xs font-mono tabular-nums whitespace-nowrap">
								{pothole.lat.toFixed(4)}, {pothole.lng.toFixed(4)}
							</td>
							<td class="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
								{formatDistanceToNow(new Date(pothole.created_at), { addSuffix: true })}
							</td>
							<td class="px-4 py-3 text-right">
								<a
									href="/admin/potholes/{pothole.id}"
									class="text-xs text-sky-400 hover:text-sky-300 hover:underline transition-colors"
								>
									Manage →
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
