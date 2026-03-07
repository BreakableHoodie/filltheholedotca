<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { formatDistanceToNow } from 'date-fns';
	import { toast } from 'svelte-sonner';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// ── Selection state ───────────────────────────────────────────────────────
	let selected = new SvelteSet<string>();

	const allIds = $derived(data.potholes.map((p) => p.id));
	const allSelected = $derived(allIds.length > 0 && allIds.every((id) => selected.has(id)));
	const someSelected = $derived(selected.size > 0);

	function toggleAll() {
		if (allSelected) {
			allIds.forEach((id) => selected.delete(id));
		} else {
			allIds.forEach((id) => selected.add(id));
		}
	}

	// ── Optimistic individual photo toggle ────────────────────────────────────
	let localOverrides = $state<Record<string, boolean>>({});

	const photosPublished = $derived(
		Object.fromEntries(
			data.potholes.map((p) => [
				p.id,
				p.id in localOverrides ? localOverrides[p.id] : (p.photos_published ?? false)
			])
		)
	);

	async function togglePhotosPublished(id: string) {
		const next = !photosPublished[id];
		localOverrides[id] = next;
		try {
			const res = await fetch(`/api/admin/pothole/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ photos_published: next })
			});
			if (!res.ok) localOverrides[id] = !next;
		} catch {
			localOverrides[id] = !next;
		}
	}

	// ── Bulk action state ─────────────────────────────────────────────────────
	let bulkStatus = $state('reported');

	// ── Bulk form enhance handler ─────────────────────────────────────────────
	function makeBulkEnhance() {
		return function ({ formData }: { formData: FormData }) {
			// Inject selected IDs into whichever form was submitted
			selected.forEach((id) => formData.append('ids', id));

			return async ({ result, update }: { result: import('@sveltejs/kit').ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
				await update({ reset: false });
				selected.clear();
				localOverrides = {};

				if (result.type === 'success' && result.data) {
					const d = result.data as { action: string; count: number; status?: string; published?: boolean };
					if (d.action === 'delete') toast.success(`Deleted ${d.count} pothole${d.count !== 1 ? 's' : ''}`);
					else if (d.action === 'status') toast.success(`Set ${d.count} to "${d.status}"`);
					else if (d.action === 'photos')
						toast.success(`Photos ${d.published ? 'published' : 'hidden'} for ${d.count} pothole${d.count !== 1 ? 's' : ''}`);
				} else if (result.type === 'failure') {
					toast.error((result.data as { error?: string })?.error ?? 'Action failed');
				}
			};
		};
	}

	// ── URL helpers ───────────────────────────────────────────────────────────
	function buildParams(overrides: Record<string, string | null> = {}): URLSearchParams {
		const p = new URLSearchParams();
		const current: Record<string, string | null> = {
			status: data.filterStatus,
			search: data.search,
			photosPublished: data.filterPhotosPublished === null ? null : String(data.filterPhotosPublished),
			dateFrom: data.dateFrom,
			dateTo: data.dateTo,
			sort: data.sort,
			dir: data.dir,
			pageSize: String(data.pageSize)
		};
		const merged = { ...current, ...overrides };
		for (const [k, v] of Object.entries(merged)) {
			if (v !== null && v !== '') p.set(k, v);
		}
		return p;
	}

	function sortHref(col: string): string {
		const nextDir = data.sort === col && data.dir === 'asc' ? 'desc' : 'asc';
		return '?' + buildParams({ sort: col, dir: nextDir, page: '1' });
	}

	function sortIcon(col: string): string {
		if (data.sort !== col) return '↕';
		return data.dir === 'asc' ? '↑' : '↓';
	}

	function pageHref(p: number): string {
		return '?' + buildParams({ page: String(p) });
	}

	function exportUrl(format: 'csv' | 'json'): string {
		const p = buildParams({ format });
		p.delete('page');
		p.delete('pageSize');
		p.delete('sort');
		p.delete('dir');
		if (someSelected) {
			selected.forEach((id) => p.append('ids', id));
		}
		return '/api/admin/potholes/export?' + p;
	}

	// ── Misc helpers ──────────────────────────────────────────────────────────
	function statusColor(status: string): string {
		switch (status) {
			case 'reported': return 'text-sky-400 bg-sky-500/10';
			case 'filled':   return 'text-emerald-400 bg-emerald-500/10';
			case 'expired':  return 'text-amber-400 bg-amber-500/10';
			default:         return 'text-zinc-400 bg-zinc-700/50';
		}
	}

	const totalPages = $derived(Math.ceil(data.total / data.pageSize));
	const rangeFrom = $derived((data.page - 1) * data.pageSize + 1);
	const rangeTo = $derived(Math.min(data.page * data.pageSize, data.total));

	// Filter form local values (bound to hidden inputs for submission)
	let filterSearch = $state(untrack(() => data.search ?? ''));
	let filterStatus = $state(untrack(() => data.filterStatus ?? ''));
	let filterPhotos = $state(untrack(() =>
		data.filterPhotosPublished === null ? '' : String(data.filterPhotosPublished)
	));
	let filterDateFrom = $state(untrack(() => data.dateFrom ?? ''));
	let filterDateTo = $state(untrack(() => data.dateTo ?? ''));
</script>

<svelte:head>
	<title>Potholes — fillthehole.ca Admin</title>
</svelte:head>

<!-- Hidden bulk-action forms (IDs injected by enhance handler) -->
<form id="bulk-main" method="post" use:enhance={makeBulkEnhance()} hidden>
	<input type="hidden" name="status" value={bulkStatus} />
</form>
<form id="bulk-pub" method="post" action="?/bulkTogglePhotos" use:enhance={makeBulkEnhance()} hidden>
	<input type="hidden" name="photos_published" value="true" />
</form>
<form id="bulk-unpub" method="post" action="?/bulkTogglePhotos" use:enhance={makeBulkEnhance()} hidden>
	<input type="hidden" name="photos_published" value="false" />
</form>

<div class="p-6 space-y-5">
	<!-- Header -->
	<div class="flex items-start justify-between gap-4 flex-wrap">
		<div>
			<h1 class="text-xl font-semibold text-zinc-100">Potholes</h1>
			<p class="text-zinc-500 text-sm mt-0.5">
				{data.total} pothole{data.total !== 1 ? 's' : ''}
				{data.filterStatus ? `with status "${data.filterStatus}"` : data.search ? `matching "${data.search}"` : 'total'}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<a
				href={exportUrl('csv')}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
				title={someSelected ? `Export ${selected.size} selected` : 'Export current filters'}
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
				</svg>
				CSV
			</a>
			<a
				href={exportUrl('json')}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
				title={someSelected ? `Export ${selected.size} selected` : 'Export current filters'}
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
				</svg>
				JSON
			</a>
		</div>
	</div>

	<!-- Filter bar -->
	<form method="get" class="flex flex-wrap gap-2 items-end">
		<div class="flex-1 min-w-[180px]">
			<label for="search" class="block text-xs text-zinc-500 mb-1">Search address</label>
			<input
				id="search"
				name="search"
				type="text"
				bind:value={filterSearch}
				placeholder="e.g. King St"
				class="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500"
			/>
		</div>
		<div>
			<label for="filter-status" class="block text-xs text-zinc-500 mb-1">Status</label>
			<select
				id="filter-status"
				name="status"
				bind:value={filterStatus}
				class="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-sky-500"
			>
				<option value="">All statuses</option>
				{#each ['pending', 'reported', 'filled', 'expired'] as s (s)}
					<option value={s}>{s}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="filter-photos" class="block text-xs text-zinc-500 mb-1">Photos</label>
			<select
				id="filter-photos"
				name="photosPublished"
				bind:value={filterPhotos}
				class="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-sky-500"
			>
				<option value="">Any</option>
				<option value="true">Published</option>
				<option value="false">Hidden</option>
			</select>
		</div>
		<div>
			<label for="date-from" class="block text-xs text-zinc-500 mb-1">From</label>
			<input
				id="date-from"
				name="dateFrom"
				type="date"
				bind:value={filterDateFrom}
				class="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-sky-500"
			/>
		</div>
		<div>
			<label for="date-to" class="block text-xs text-zinc-500 mb-1">To</label>
			<input
				id="date-to"
				name="dateTo"
				type="date"
				bind:value={filterDateTo}
				class="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-sky-500"
			/>
		</div>
		<!-- Preserve sort/dir/pageSize across filter changes -->
		<input type="hidden" name="sort" value={data.sort} />
		<input type="hidden" name="dir" value={data.dir} />
		<input type="hidden" name="pageSize" value={data.pageSize} />
		<div class="flex gap-2">
			<button
				type="submit"
				class="px-3 py-1.5 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
			>
				Filter
			</button>
			<a
				href="/admin/potholes"
				class="px-3 py-1.5 text-sm font-medium border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
			>
				Reset
			</a>
		</div>
	</form>

	<!-- Bulk toolbar (sticky, appears when items selected) -->
	{#if someSelected}
		<div class="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg">
			<span class="text-sm text-zinc-300 font-medium tabular-nums">{selected.size} selected</span>
			<div class="w-px h-4 bg-zinc-700"></div>

			<!-- Change status -->
			<div class="flex items-center gap-2">
				<select
					bind:value={bulkStatus}
					class="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
				>
					{#each ['pending', 'reported', 'filled', 'expired'] as s (s)}
						<option value={s}>{s}</option>
					{/each}
				</select>
				<button
					type="submit"
					form="bulk-main"
					formaction="?/bulkChangeStatus"
					class="px-3 py-1 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
				>
					Set status
				</button>
			</div>

			<div class="w-px h-4 bg-zinc-700"></div>

			<!-- Photo visibility -->
			<button
				type="submit"
				form="bulk-pub"
				class="px-3 py-1 text-xs font-medium border border-emerald-600/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded transition-colors"
			>
				Publish photos
			</button>
			<button
				type="submit"
				form="bulk-unpub"
				class="px-3 py-1 text-xs font-medium border border-zinc-600 text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
			>
				Hide photos
			</button>

			<div class="w-px h-4 bg-zinc-700"></div>

			<!-- Export selection -->
			<a
				href={exportUrl('csv')}
				class="px-3 py-1 text-xs font-medium border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
			>↓ CSV</a>
			<a
				href={exportUrl('json')}
				class="px-3 py-1 text-xs font-medium border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
			>↓ JSON</a>

			{#if data.adminRole === 'admin'}
				<div class="w-px h-4 bg-zinc-700"></div>
				<button
					type="submit"
					form="bulk-main"
					formaction="?/bulkDelete"
					onclick={(e) => {
						if (!confirm(`Delete ${selected.size} pothole${selected.size !== 1 ? 's' : ''} permanently? This cannot be undone.`)) e.preventDefault();
					}}
					class="px-3 py-1 text-xs font-medium bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded transition-colors"
				>
					Delete
				</button>
			{/if}

			<button
				type="button"
				onclick={() => selected.clear()}
				class="ml-auto text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
			>
				Clear selection
			</button>
		</div>
	{/if}

	{#if data.potholes.length === 0}
		<div class="text-center py-20">
			<div class="text-4xl mb-3">🕳️</div>
			<p class="text-zinc-400 font-medium">No potholes found</p>
			<p class="text-zinc-600 text-sm mt-1">Try adjusting your filters.</p>
		</div>
	{:else}
		<div class="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm min-w-[780px]">
					<thead>
						<tr class="border-b border-zinc-800 text-left">
							<th class="px-4 py-3 w-10">
								<input
									type="checkbox"
									checked={allSelected}
									indeterminate={someSelected && !allSelected}
									onchange={toggleAll}
									class="rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-sky-500/20"
									aria-label="Select all"
								/>
							</th>
							<th class="px-4 py-3 text-zinc-500 font-medium">
								<a href={sortHref('address')} class="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors">
									Address <span class="text-zinc-600">{sortIcon('address')}</span>
								</a>
							</th>
							<th class="px-4 py-3 text-zinc-500 font-medium">
								<a href={sortHref('status')} class="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors">
									Status <span class="text-zinc-600">{sortIcon('status')}</span>
								</a>
							</th>
							<th class="px-4 py-3 text-zinc-500 font-medium">
								<a href={sortHref('confirmed_count')} class="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors">
									Conf. <span class="text-zinc-600">{sortIcon('confirmed_count')}</span>
								</a>
							</th>
							<th class="px-4 py-3 text-zinc-500 font-medium">Photos</th>
							<th class="px-4 py-3 text-zinc-500 font-medium">Visibility</th>
							<th class="px-4 py-3 text-zinc-500 font-medium">
								<a href={sortHref('created_at')} class="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors">
									Reported <span class="text-zinc-600">{sortIcon('created_at')}</span>
								</a>
							</th>
							<th class="px-4 py-3 text-zinc-500 font-medium sr-only">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-zinc-800">
						{#each data.potholes as pothole (pothole.id)}
							{@const photoCount = pothole.pothole_photos?.length ?? 0}
							<tr
								class="hover:bg-zinc-800/40 transition-colors {selected.has(pothole.id) ? 'bg-sky-500/5' : ''}"
							>
								<td class="px-4 py-3">
									<input
										type="checkbox"
										checked={selected.has(pothole.id)}
										onchange={() => {
											if (selected.has(pothole.id)) selected.delete(pothole.id);
											else selected.add(pothole.id);
										}}
										class="rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-sky-500/20"
										aria-label="Select {pothole.address ?? pothole.id}"
									/>
								</td>
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
								<td class="px-4 py-3">
									{#if photoCount > 0}
										<span class="inline-flex items-center gap-1 text-xs text-zinc-300">
											<svg class="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
											</svg>
											{photoCount}
										</span>
									{:else}
										<span class="text-zinc-700 text-xs">—</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									{#if photoCount > 0}
										<button
											onclick={() => togglePhotosPublished(pothole.id)}
											class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border transition-colors
											       {photosPublished[pothole.id]
												? 'border-emerald-600/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
												: 'border-zinc-700 text-zinc-500 bg-zinc-800/50 hover:bg-zinc-700 hover:text-zinc-300'}"
										>
											{photosPublished[pothole.id] ? 'Published' : 'Hidden'}
										</button>
									{:else}
										<span class="text-zinc-700 text-xs">—</span>
									{/if}
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
		</div>

		<!-- Pagination -->
		<div class="flex items-center justify-between gap-4 flex-wrap text-sm">
			<p class="text-zinc-500 text-xs">
				{#if data.total > 0}
					Showing {rangeFrom}–{rangeTo} of {data.total}
				{/if}
			</p>
			<div class="flex items-center gap-2">
				{#if data.page > 1}
					<a
						href={pageHref(data.page - 1)}
						class="px-3 py-1.5 text-xs font-medium border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
					>
						← Prev
					</a>
				{/if}
				<span class="text-zinc-500 text-xs tabular-nums">
					Page {data.page} of {totalPages}
				</span>
				{#if data.page < totalPages}
					<a
						href={pageHref(data.page + 1)}
						class="px-3 py-1.5 text-xs font-medium border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
					>
						Next →
					</a>
				{/if}
			</div>
			<form method="get" class="flex items-center gap-2">
				<!-- Preserve current filters when changing page size -->
				{#if data.filterStatus}<input type="hidden" name="status" value={data.filterStatus} />{/if}
				{#if data.search}<input type="hidden" name="search" value={data.search} />{/if}
				{#if data.filterPhotosPublished !== null}<input type="hidden" name="photosPublished" value={String(data.filterPhotosPublished)} />{/if}
				{#if data.dateFrom}<input type="hidden" name="dateFrom" value={data.dateFrom} />{/if}
				{#if data.dateTo}<input type="hidden" name="dateTo" value={data.dateTo} />{/if}
				<input type="hidden" name="sort" value={data.sort} />
				<input type="hidden" name="dir" value={data.dir} />
				<label for="page-size" class="text-xs text-zinc-500">Per page</label>
				<select
					id="page-size"
					name="pageSize"
					onchange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
					class="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
				>
					{#each [25, 50, 100] as size (size)}
						<option value={size} selected={data.pageSize === size}>{size}</option>
					{/each}
				</select>
			</form>
		</div>
	{/if}
</div>
