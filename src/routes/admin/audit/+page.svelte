<script lang="ts">
	import type { PageData } from './$types';
	import type { AuditEntry } from './+page.server.ts';
	import { formatDistanceToNow, format } from 'date-fns';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const RESOURCE_TYPES = [
		{ value: '', label: 'All resources' },
		{ value: 'photo', label: 'Photos' },
		{ value: 'pothole', label: 'Potholes' },
		{ value: 'user', label: 'Users' },
		{ value: 'invite', label: 'Invites' },
		{ value: 'session', label: 'Sessions' },
		{ value: 'password', label: 'Password' }
	];

	function actionBadgeClass(action: string): string {
		if (/delete|deactivate|disable|revoke|reject/.test(action))
			return 'text-red-400 bg-red-500/10 border border-red-500/20';
		if (/update|change|override|edit|reset|regen/.test(action))
			return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
		if (/approve|activate|enable|confirm|create|login/.test(action))
			return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
		return 'text-sky-400 bg-sky-500/10 border border-sky-500/20';
	}

	function resourceLink(entry: AuditEntry): string | null {
		if (!entry.resource_id) return null;
		if (entry.resource_type === 'pothole') return `/admin/potholes/${entry.resource_id}`;
		return null;
	}

	function detailsSnippet(details: Record<string, unknown> | null): string {
		if (!details) return '';
		const s = JSON.stringify(details);
		return s.length > 80 ? s.slice(0, 80) + '…' : s;
	}

	function actorLabel(entry: AuditEntry): string {
		if (!entry.admin_users) return 'System';
		return `${entry.admin_users.first_name} ${entry.admin_users.last_name}`;
	}

	function actorEmail(entry: AuditEntry): string {
		return entry.admin_users?.email ?? '';
	}

	const hasFilters = $derived(
		!!(data.filterUser || data.filterResourceType || data.filterAction)
	);
</script>

<svelte:head>
	<title>Audit Log — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-xl font-semibold text-zinc-100">Audit Log</h1>
			<p class="text-zinc-500 text-sm mt-0.5">
				{#if data.totalCount > 0}
					Showing {data.firstEntry}–{data.lastEntry} of {data.totalCount} entries
				{:else}
					No entries found
				{/if}
			</p>
		</div>

		{#if hasFilters}
			<a
				href="/admin/audit"
				class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
			>
				Clear filters
			</a>
		{/if}
	</div>

	<!-- Filters -->
	<form method="get" class="flex flex-wrap items-end gap-3 mb-5">
		<div>
			<label for="filter-user" class="block text-xs text-zinc-500 mb-1">Actor</label>
			<select
				id="filter-user"
				name="user"
				onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.submit()}
				class="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
			>
				<option value="">All users</option>
				{#each data.users as u (u.id)}
					<option value={u.id} selected={data.filterUser === u.id}>
						{u.first_name} {u.last_name} ({u.email})
					</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="filter-resource" class="block text-xs text-zinc-500 mb-1">Resource type</label>
			<select
				id="filter-resource"
				name="resource_type"
				onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.submit()}
				class="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-sky-500 cursor-pointer"
			>
				{#each RESOURCE_TYPES as rt (rt.value)}
					<option value={rt.value} selected={data.filterResourceType === rt.value}>
						{rt.label}
					</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="filter-action" class="block text-xs text-zinc-500 mb-1">Action</label>
			<div class="flex gap-2">
				<input
					id="filter-action"
					name="action"
					type="text"
					value={data.filterAction ?? ''}
					placeholder="e.g. photo.approve"
					class="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-sky-500 w-48"
				/>
				<!-- Preserve other filter values when submitting the text input -->
				{#if data.filterUser}<input type="hidden" name="user" value={data.filterUser} />{/if}
				{#if data.filterResourceType}<input type="hidden" name="resource_type" value={data.filterResourceType} />{/if}
				<button
					type="submit"
					class="px-3 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg transition-colors"
				>
					Search
				</button>
			</div>
		</div>
	</form>

	<!-- Log table -->
	<div class="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-zinc-800 text-left">
					<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide w-44">Time</th>
					<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Actor</th>
					<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Action</th>
					<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Resource</th>
					<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Details</th>
					<th class="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide w-32">IP</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-zinc-800">
				{#each data.entries as entry (entry.id)}
					<tr class="hover:bg-zinc-800/40 transition-colors">
						<!-- Time -->
						<td class="px-4 py-3 whitespace-nowrap">
							<span
								class="text-zinc-300 text-xs"
								title={format(new Date(entry.created_at), 'PPpp')}
							>
								{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
							</span>
							<span class="block text-zinc-600 text-xs mt-0.5">
								{format(new Date(entry.created_at), 'MMM d, HH:mm')}
							</span>
						</td>

						<!-- Actor -->
						<td class="px-4 py-3">
							<span class="text-zinc-200 text-xs font-medium">{actorLabel(entry)}</span>
							{#if actorEmail(entry)}
								<span class="block text-zinc-600 text-xs">{actorEmail(entry)}</span>
							{/if}
						</td>

						<!-- Action -->
						<td class="px-4 py-3">
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono {actionBadgeClass(entry.action)}">
								{entry.action}
							</span>
						</td>

						<!-- Resource -->
						<td class="px-4 py-3">
							{#if entry.resource_type}
								<span class="text-zinc-400 text-xs capitalize">{entry.resource_type}</span>
								{#if entry.resource_id}
									{@const link = resourceLink(entry)}
									{#if link}
										<a
											href={link}
											class="block text-sky-500 text-xs font-mono hover:text-sky-400 transition-colors mt-0.5"
										>
											{entry.resource_id.slice(0, 8)}…
										</a>
									{:else}
										<span class="block text-zinc-600 text-xs font-mono mt-0.5">
											{entry.resource_id.slice(0, 8)}…
										</span>
									{/if}
								{/if}
							{:else}
								<span class="text-zinc-700 text-xs">—</span>
							{/if}
						</td>

						<!-- Details -->
						<td class="px-4 py-3 max-w-xs">
							{#if entry.details}
								<span class="text-zinc-600 text-xs font-mono break-all" title={JSON.stringify(entry.details, null, 2)}>
									{detailsSnippet(entry.details)}
								</span>
							{:else}
								<span class="text-zinc-700 text-xs">—</span>
							{/if}
						</td>

						<!-- IP hash (stored as HMAC-SHA-256, not shown to avoid confusion) -->
						<td class="px-4 py-3">
							<span class="text-zinc-700 text-xs">—</span>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="px-4 py-10 text-center text-zinc-600 text-sm">
							{hasFilters ? 'No entries match your filters.' : 'No audit entries yet.'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if data.totalPages > 1}
		<div class="flex items-center justify-between mt-4">
			<div>
				{#if data.prevUrl}
					<a
						href={data.prevUrl}
						class="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-600 rounded transition-colors"
					>
						← Previous
					</a>
				{:else}
					<span class="px-3 py-1.5 text-sm text-zinc-700 border border-zinc-800 rounded cursor-not-allowed">
						← Previous
					</span>
				{/if}
			</div>

			<span class="text-sm text-zinc-500">
				Page {data.page} of {data.totalPages}
			</span>

			<div>
				{#if data.nextUrl}
					<a
						href={data.nextUrl}
						class="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-600 rounded transition-colors"
					>
						Next →
					</a>
				{:else}
					<span class="px-3 py-1.5 text-sm text-zinc-700 border border-zinc-800 rounded cursor-not-allowed">
						Next →
					</span>
				{/if}
			</div>
		</div>
	{/if}
</div>
