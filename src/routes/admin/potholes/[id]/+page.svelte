<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { formatDistanceToNow, format } from 'date-fns';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	const pothole = $derived(data.pothole);
	const isAdmin = $derived(data.adminUser?.role === 'admin');

	let addressValue = $state(data.pothole.address ?? '');

	function statusColor(status: string): string {
		switch (status) {
			case 'reported':
				return 'text-sky-400 bg-sky-500/10 border border-sky-500/20';
			case 'filled':
				return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
			case 'expired':
				return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
			default:
				return 'text-zinc-300 bg-zinc-700/50 border border-zinc-600/30';
		}
	}

	function photoStatusColor(status: string): string {
		switch (status) {
			case 'approved':
				return 'text-emerald-400 bg-emerald-500/10';
			case 'rejected':
				return 'text-red-400 bg-red-500/10';
			default:
				return 'text-amber-400 bg-amber-500/10';
		}
	}

	// Mask IP hash — show first 8 chars only
	function maskHash(hash: string): string {
		return hash.slice(0, 8) + '…';
	}
</script>

<svelte:head>
	<title>Pothole {data.pothole.id.slice(0, 8)} — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6 max-w-5xl">
	<!-- Breadcrumb -->
	<nav class="flex items-center gap-2 text-sm text-zinc-500 mb-5">
		<a href="/admin/potholes" class="hover:text-zinc-300 transition-colors">Potholes</a>
		<span>/</span>
		<span class="text-zinc-300 font-mono">{pothole.id.slice(0, 8)}…</span>
	</nav>

	<!-- Error / success flash -->
	{#if form?.error}
		<div class="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
			Saved successfully.
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

		<!-- ─── Left: info + edit forms ─── -->
		<div class="lg:col-span-2 space-y-5">

			<!-- Info card -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
				<div class="flex items-start justify-between gap-3 mb-4">
					<div>
						<h1 class="text-lg font-semibold text-zinc-100 leading-tight">
							{pothole.address ?? 'No address'}
						</h1>
						<p class="text-zinc-500 text-xs font-mono mt-1">{pothole.id}</p>
					</div>
					<span class="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium capitalize flex-shrink-0 {statusColor(pothole.status)}">
						{pothole.status}
					</span>
				</div>

				<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
					<div>
						<dt class="text-zinc-500 text-xs">Coordinates</dt>
						<dd class="text-zinc-300 font-mono text-xs mt-0.5">
							{pothole.lat.toFixed(6)}, {pothole.lng.toFixed(6)}
						</dd>
					</div>
					<div>
						<dt class="text-zinc-500 text-xs">Confirmations</dt>
						<dd class="text-zinc-300 mt-0.5">{pothole.confirmed_count}</dd>
					</div>
					<div>
						<dt class="text-zinc-500 text-xs">Reported</dt>
						<dd class="text-zinc-300 mt-0.5 text-xs">
							{format(new Date(pothole.created_at), 'PPp')}
						</dd>
					</div>
					{#if pothole.filled_at}
						<div>
							<dt class="text-zinc-500 text-xs">Filled</dt>
							<dd class="text-zinc-300 mt-0.5 text-xs">
								{format(new Date(pothole.filled_at), 'PPp')}
							</dd>
						</div>
					{/if}
					{#if pothole.expired_at}
						<div>
							<dt class="text-zinc-500 text-xs">Expired</dt>
							<dd class="text-zinc-300 mt-0.5 text-xs">
								{format(new Date(pothole.expired_at), 'PPp')}
							</dd>
						</div>
					{/if}
					{#if pothole.description}
						<div class="col-span-2">
							<dt class="text-zinc-500 text-xs">Description</dt>
							<dd class="text-zinc-300 mt-0.5">{pothole.description}</dd>
						</div>
					{/if}
				</dl>

				<!-- Map link -->
				<a
					href="https://www.openstreetmap.org/?mlat={pothole.lat}&mlon={pothole.lng}&zoom=17"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 mt-4 text-xs text-sky-400 hover:text-sky-300 transition-colors"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					View on OpenStreetMap
				</a>
			</div>

			<!-- Status override -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
				<h2 class="text-sm font-medium text-zinc-300 mb-3">Override Status</h2>
				<form method="post" action="?/updateStatus" use:enhance class="flex items-end gap-3">
					<div class="flex-1">
						<label for="status" class="block text-xs text-zinc-500 mb-1.5">Status</label>
						<select
							id="status"
							name="status"
							class="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
						>
							{#each ['pending', 'reported', 'filled', 'expired'] as s (s)}
								<option value={s} selected={pothole.status === s}>{s}</option>
							{/each}
						</select>
					</div>
					<button
						type="submit"
						class="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
					>
						Save
					</button>
				</form>
				<p class="text-zinc-600 text-xs mt-2">
					Setting to "filled" or "expired" updates the corresponding timestamp. Other transitions clear it.
				</p>
			</div>

			<!-- Address edit -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
				<h2 class="text-sm font-medium text-zinc-300 mb-3">Edit Address</h2>
				<form method="post" action="?/updateAddress" use:enhance class="flex items-end gap-3">
					<div class="flex-1">
						<label for="address" class="block text-xs text-zinc-500 mb-1.5">Address</label>
						<input
							id="address"
							name="address"
							type="text"
							bind:value={addressValue}
							class="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
							placeholder="e.g. 123 King St W, Kitchener"
							maxlength="500"
						/>
					</div>
					<button
						type="submit"
						class="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
					>
						Save
					</button>
				</form>
			</div>

			<!-- Confirmations -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
				<div class="px-4 py-3 border-b border-zinc-800">
					<h2 class="text-sm font-medium text-zinc-300">
						Confirmations
						<span class="ml-1.5 text-zinc-500 font-normal">({data.confirmations.length})</span>
					</h2>
				</div>

				{#if data.confirmations.length === 0}
					<p class="text-zinc-600 text-sm px-4 py-4">No confirmations yet.</p>
				{:else}
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-zinc-800 text-left">
								<th class="px-4 py-2.5 text-zinc-500 font-medium text-xs">#</th>
								<th class="px-4 py-2.5 text-zinc-500 font-medium text-xs">IP Hash</th>
								<th class="px-4 py-2.5 text-zinc-500 font-medium text-xs">When</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-zinc-800/60">
							{#each data.confirmations as c, i (c.id)}
								<tr>
									<td class="px-4 py-2.5 text-zinc-500 text-xs">{i + 1}</td>
									<td class="px-4 py-2.5 text-zinc-400 font-mono text-xs">{maskHash(c.ip_hash)}</td>
									<td class="px-4 py-2.5 text-zinc-500 text-xs">
										{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>

		<!-- ─── Right: photos + danger ─── -->
		<div class="space-y-5">

			<!-- Photos -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
				<div class="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
					<h2 class="text-sm font-medium text-zinc-300">
						Photos
						<span class="ml-1.5 text-zinc-500 font-normal">({data.photos.length})</span>
					</h2>
					{#if data.photos.length > 0}
						<a
							href="/admin/photos"
							class="text-xs text-sky-400 hover:text-sky-300 transition-colors"
						>
							Review queue →
						</a>
					{/if}
				</div>

				{#if data.photos.length === 0}
					<p class="text-zinc-600 text-sm px-4 py-4">No photos uploaded.</p>
				{:else}
					<div class="p-3 space-y-2">
						{#each data.photos as photo (photo.id)}
							<div class="flex gap-3 items-start">
								{#if photo.url}
									<a href={photo.url} target="_blank" rel="noopener noreferrer" class="flex-shrink-0">
										<img
											src={photo.url}
											alt="Pothole photo"
											loading="lazy"
											class="w-16 h-16 object-cover rounded bg-zinc-800"
										/>
									</a>
								{:else}
									<div class="w-16 h-16 rounded bg-zinc-800 flex items-center justify-center text-zinc-600 flex-shrink-0">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium capitalize {photoStatusColor(photo.moderation_status)}">
										{photo.moderation_status}
									</span>
									<p class="text-zinc-600 text-xs mt-1">
										{formatDistanceToNow(new Date(photo.created_at), { addSuffix: true })}
									</p>
									{#if photo.moderation_score !== null}
										<p class="text-zinc-600 text-xs">
											Score: {Math.round(photo.moderation_score * 100)}%
										</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Danger zone (admin only) -->
			{#if isAdmin}
				<div class="bg-zinc-900 border border-red-900/40 rounded-lg p-4">
					<h2 class="text-sm font-medium text-red-400 mb-1">Danger Zone</h2>
					<p class="text-zinc-500 text-xs mb-3">
						Permanently deletes this pothole, all confirmations, and photos. This cannot be undone.
					</p>
					<form
						method="post"
						action="?/deletePothole"
						onsubmit={(e) => {
							if (!confirm('Delete this pothole permanently? This cannot be undone.')) {
								e.preventDefault();
							}
						}}
					>
						<button
							type="submit"
							class="w-full py-2 text-sm font-medium bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded transition-colors"
						>
							Delete Pothole
						</button>
					</form>
				</div>
			{/if}
		</div>
	</div>
</div>
