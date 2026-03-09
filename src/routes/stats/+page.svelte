<script lang="ts">
	import { onMount } from 'svelte';
	import { format } from 'date-fns';
	import type { PageData } from './$types';
	import type { Pothole } from '$lib/types';
	import { COUNCILLORS } from '$lib/wards';
	import { inWardFeature } from '$lib/geo';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: { data: PageData } = $props();
	let allPotholes = $derived(data.potholes as Pothole[]);

	// ── Time filter ────────────────────────────────────────────────────────────
	type WindowDays = 30 | 90 | 365 | null;
	let windowDays = $state<WindowDays>(null);

	const WINDOWS: { label: string; value: WindowDays }[] = [
		{ label: 'All time', value: null },
		{ label: '1 year',   value: 365 },
		{ label: '90 days',  value: 90 },
		{ label: '30 days',  value: 30 }
	];

	let filtered = $derived(
		windowDays === null
			? allPotholes
			: allPotholes.filter(p => {
					const ms = Date.now() - new Date(p.created_at).getTime();
					return ms <= windowDays! * 86_400_000;
				})
	);

	// ── Summary stats ──────────────────────────────────────────────────────────
	let totalConfirmed = $derived(filtered.length);
	let totalFilled    = $derived(filtered.filter(p => p.status === 'filled').length);
	let totalOpen      = $derived(filtered.filter(p => p.status === 'reported' || p.status === 'expired').length);
	let fillRate       = $derived(totalConfirmed === 0 ? null : (totalFilled / totalConfirmed) * 100);

	let avgDaysToFill = $derived.by(() => {
		const done = filtered.filter(p => p.status === 'filled' && p.filled_at);
		if (!done.length) return null;
		const ms = done.reduce(
			(s, p) => s + new Date(p.filled_at!).getTime() - new Date(p.created_at).getTime(),
			0
		);
		return ms / done.length / 86_400_000;
	});

	// ── Monthly trend (always full dataset, last 18 months) ───────────────────
	let monthlyData = $derived.by(() => {
		const now = new Date();
		const monthKeys: string[] = [];
		const months: Record<string, { label: string; reported: number; filled: number }> = {};
		for (let i = 17; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			monthKeys.push(key);
			months[key] = { label: format(d, 'MMM yy'), reported: 0, filled: 0 };
		}
		for (const p of allPotholes) {
			const rk = p.created_at.slice(0, 7);
			if (rk in months) months[rk].reported++;
			if (p.filled_at) {
				const fk = p.filled_at.slice(0, 7);
				if (fk in months) months[fk].filled++;
			}
		}
		return monthKeys.map(k => ({ key: k, ...months[k] }));
	});

	let monthlyMax = $derived(
		Math.max(...monthlyData.map(m => Math.max(m.reported, m.filled)), 1)
	);

	// ── Ward leaderboard ───────────────────────────────────────────────────────
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let wardGeojson = $state<any>(null);
	let wardLoading = $state(false);
	let wardError   = $state(false);

	onMount(async () => {
		wardLoading = true;
		try {
			const res = await fetch('/api/wards.geojson');
			if (!res.ok) throw new Error(`${res.status}`);
			wardGeojson = await res.json();
		} catch {
			wardError = true;
		} finally {
			wardLoading = false;
		}
	});

	interface WardRow {
		city: string; ward: number; key: string;
		councillorName: string; councillorUrl: string;
		open: number; filled: number; total: number;
		fillRate: number; avgDays: number | null;
	}

	type SortCol = 'open' | 'total' | 'fillRate' | 'avgDays';
	let sortCol = $state<SortCol>('open');
	let sortAsc = $state(false);

	function setSort(col: SortCol) {
		if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = false; }
	}

	let wardRows = $derived.by((): WardRow[] => {
		if (!wardGeojson?.features?.length) return [];

		const stats: Record<string, WardRow> = {};
		const filledTimes: Record<string, number[]> = {};

		for (const f of wardGeojson.features) {
			const city = String(f.properties?.CITY ?? '');
			const ward = Number(f.properties?.WARDID_NORM ?? 0);
			if (!city || !ward) continue;
			const key = `${city}-${ward}`;
			if (key in stats) continue;
			const councillor = COUNCILLORS.find(c => c.city === city && c.ward === ward);
			stats[key] = {
				city, ward, key,
				councillorName: councillor?.name ?? '—',
				councillorUrl:  councillor?.url  ?? '',
				open: 0, filled: 0, total: 0, fillRate: 0, avgDays: null
			};
		}

		for (const p of filtered) {
			for (const f of wardGeojson.features) {
				if (!inWardFeature(p.lng, p.lat, f.geometry)) continue;
				const city = String(f.properties?.CITY ?? '');
				const ward = Number(f.properties?.WARDID_NORM ?? 0);
				const key  = `${city}-${ward}`;
				if (!(key in stats)) break;
				stats[key].total++;
				if (p.status === 'filled') {
					stats[key].filled++;
					if (p.filled_at) {
						const days = (new Date(p.filled_at).getTime() - new Date(p.created_at).getTime()) / 86_400_000;
						(filledTimes[key] ??= []).push(days);
					}
				} else if (p.status === 'reported' || p.status === 'expired') {
					stats[key].open++;
				}
				break;
			}
		}

		return Object.values(stats)
			.map(s => ({
				...s,
				fillRate: s.total === 0 ? 0 : (s.filled / s.total) * 100,
				avgDays:  filledTimes[s.key]?.length
					? filledTimes[s.key].reduce((a, b) => a + b, 0) / filledTimes[s.key].length
					: null
			}))
			.filter(s => s.total > 0)
			.sort((a, b) => {
				// Null values always sort to the end regardless of direction
				const nullFill = sortAsc ? Infinity : -Infinity;
				const va = (a[sortCol] ?? nullFill) as number;
				const vb = (b[sortCol] ?? nullFill) as number;
				return sortAsc ? va - vb : vb - va;
			});
	});

	// City-level aggregation derived from ward rows
	let cityRows = $derived.by(() => {
		const cities: Record<string, {
			city: string; total: number; open: number; filled: number;
			filledDaySum: number; filledCount: number;
		}> = {};
		for (const r of wardRows) {
			if (!(r.city in cities)) {
				cities[r.city] = { city: r.city, total: 0, open: 0, filled: 0, filledDaySum: 0, filledCount: 0 };
			}
			cities[r.city].total  += r.total;
			cities[r.city].open   += r.open;
			cities[r.city].filled += r.filled;
			if (r.avgDays !== null) {
				cities[r.city].filledDaySum  += r.avgDays * r.filled;
				cities[r.city].filledCount   += r.filled;
			}
		}
		return Object.values(cities)
			.map(c => ({
				city:     c.city.charAt(0).toUpperCase() + c.city.slice(1),
				total:    c.total,
				open:     c.open,
				filled:   c.filled,
				fillRate: c.total === 0 ? null : (c.filled / c.total) * 100,
				avgDays:  c.filledCount > 0 ? c.filledDaySum / c.filledCount : null
			}))
			.sort((a, b) => b.open - a.open);
	});

	// Worst offenders: longest-open unfilled potholes
	let offenders = $derived(
		filtered
			.filter(p => p.status === 'reported')
			.map(p => ({ ...p, days: Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000) }))
			.sort((a, b) => b.days - a.days)
			.slice(0, 10)
	);

	// ── Helpers ────────────────────────────────────────────────────────────────
	function fmt(n: number | null, decimals = 0): string {
		return n === null ? '—' : n.toFixed(decimals);
	}

	function sortLabel(col: SortCol): string {
		if (sortCol !== col) return '';
		return sortAsc ? '↑' : '↓';
	}
</script>

<svelte:head>
	<title>Stats — FillTheHole.ca</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-10 space-y-10">

	<!-- Page header + time filter -->
	<div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
		<div>
			<h1 class="font-brand font-bold text-3xl text-white flex items-center gap-2.5">
				<Icon name="bar-chart-2" size={26} class="text-sky-400 shrink-0" />
				By the numbers
			</h1>
			<p class="text-zinc-400 mt-1">Pothole accountability data for Waterloo Region.</p>
		</div>

		<div
			class="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded-lg p-1"
			role="group"
			aria-label="Filter by time window"
		>
			{#each WINDOWS as w (w.value ?? 'all')}
				<button
					onclick={() => (windowDays = w.value)}
					aria-pressed={windowDays === w.value}
					class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-zinc-900
						{windowDays === w.value
							? 'bg-sky-600 text-white'
							: 'text-zinc-400 hover:text-white hover:bg-zinc-800'}"
				>
					{w.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- ── Summary cards ──────────────────────────────────────────────────────── -->
	<section aria-labelledby="summary-heading">
		<h2 id="summary-heading" class="sr-only">Summary statistics</h2>
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<p class="text-xs text-zinc-500 uppercase tracking-wide">Total reported</p>
				<p class="text-3xl font-bold text-white" aria-live="polite">{totalConfirmed}</p>
				<p class="text-xs text-zinc-500">confirmed potholes</p>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<p class="text-xs text-zinc-500 uppercase tracking-wide">Currently open</p>
				<p class="text-3xl font-bold text-orange-400" aria-live="polite">{totalOpen}</p>
				<p class="text-xs text-zinc-500">unfilled, on the map</p>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<p class="text-xs text-zinc-500 uppercase tracking-wide">Fill rate</p>
				<p class="text-3xl font-bold text-sky-400" aria-live="polite">
					{fillRate === null ? '—' : `${fmt(fillRate, 0)}%`}
				</p>
				<p class="text-xs text-zinc-500">{totalFilled} of {totalConfirmed} filled</p>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<p class="text-xs text-zinc-500 uppercase tracking-wide">Avg days to fill</p>
				<p class="text-3xl font-bold {avgDaysToFill === null ? 'text-zinc-500' : 'text-green-400'}" aria-live="polite">
					{avgDaysToFill === null ? '—' : fmt(avgDaysToFill, 1)}
				</p>
				<p class="text-xs text-zinc-500">from report to fixed</p>
			</div>
		</div>
	</section>

	<!-- ── Monthly trend chart ─────────────────────────────────────────────────── -->
	<section aria-labelledby="trend-heading">
		<div class="flex items-center justify-between mb-4 flex-wrap gap-3">
			<h2 id="trend-heading" class="text-lg font-semibold text-white">
				Monthly activity
				<span class="text-zinc-500 font-normal text-sm">(last 18 months, full dataset)</span>
			</h2>
			<div class="flex items-center gap-4 text-xs text-zinc-500" aria-hidden="true">
				<span class="flex items-center gap-1.5">
					<span class="w-3 h-3 rounded-sm bg-orange-500/70 inline-block"></span> Reported
				</span>
				<span class="flex items-center gap-1.5">
					<span class="w-3 h-3 rounded-sm bg-green-500/70 inline-block"></span> Filled
				</span>
			</div>
		</div>

		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
			<div
				class="flex items-end gap-px h-28"
				role="img"
				aria-label="Bar chart of monthly pothole reports and fills over the last 18 months"
			>
			{#each monthlyData as m (m.key)}
					<div class="flex-1 flex flex-col items-stretch gap-px">
						<div class="flex items-end gap-px flex-1">
							<div
								class="flex-1 bg-orange-500/70 rounded-t-sm transition-[height]"
								style="height:{Math.round((m.reported / monthlyMax) * 96)}px"
								title="{m.reported} reported in {m.label}"
							></div>
							<div
								class="flex-1 bg-green-500/70 rounded-t-sm transition-[height]"
								style="height:{Math.round((m.filled / monthlyMax) * 96)}px"
								title="{m.filled} filled in {m.label}"
							></div>
						</div>
					</div>
				{/each}
			</div>
			<!-- Month labels: every 3rd to avoid crowding on small screens -->
			<div class="flex gap-px mt-2" aria-hidden="true">
			{#each monthlyData as m, i (m.key)}
					<div class="flex-1 text-center min-w-0 overflow-hidden">
						{#if i % 3 === 0 || i === monthlyData.length - 1}
							<span class="text-zinc-600 text-[10px]">{m.label}</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── City breakdown ─────────────────────────────────────────────────────── -->
	{#if cityRows.length > 0}
		<section aria-labelledby="city-heading">
			<h2 id="city-heading" class="text-lg font-semibold text-white mb-4">By city</h2>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-zinc-800">
							<th scope="col" class="text-left px-4 py-3 text-zinc-400 font-medium">City</th>
							<th scope="col" class="text-right px-4 py-3 text-zinc-400 font-medium">Total</th>
							<th scope="col" class="text-right px-4 py-3 text-zinc-400 font-medium">Open</th>
							<th scope="col" class="text-right px-4 py-3 text-zinc-400 font-medium">Filled</th>
							<th scope="col" class="text-right px-4 py-3 text-zinc-400 font-medium">Fill rate</th>
							<th scope="col" class="text-right px-4 py-3 text-zinc-400 font-medium hidden sm:table-cell">Avg days</th>
						</tr>
					</thead>
					<tbody>
					{#each cityRows as c (c.city)}
							<tr class="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
								<td class="px-4 py-3 font-medium text-white">{c.city}</td>
								<td class="px-4 py-3 text-right text-zinc-300">{c.total}</td>
								<td class="px-4 py-3 text-right font-semibold {c.open > 0 ? 'text-orange-400' : 'text-zinc-500'}">{c.open}</td>
								<td class="px-4 py-3 text-right text-green-400">{c.filled}</td>
								<td class="px-4 py-3 text-right text-sky-400">{c.fillRate === null ? '—' : `${fmt(c.fillRate, 0)}%`}</td>
								<td class="px-4 py-3 text-right text-zinc-400 hidden sm:table-cell">{fmt(c.avgDays, 1)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<!-- ── Ward leaderboard ───────────────────────────────────────────────────── -->
	<section aria-labelledby="ward-heading">
		<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
			<h2 id="ward-heading" class="text-lg font-semibold text-white">By ward</h2>
			{#if wardLoading}
				<span class="text-xs text-zinc-500 animate-pulse" aria-live="polite">Loading ward boundaries…</span>
			{/if}
		</div>

		{#if wardError}
			<div role="alert" class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-sm">
				Could not load ward boundaries. Try refreshing the page.
			</div>
		{:else if wardLoading}
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-sm animate-pulse" aria-busy="true">
				Assigning wards…
			</div>
		{:else if wardRows.length === 0}
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-sm">
				No ward data available for the selected window.
			</div>
		{:else}
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
				<table class="w-full text-sm min-w-[580px]">
					<thead>
						<tr class="border-b border-zinc-800">
							<th scope="col" class="text-left px-4 py-3 text-zinc-400 font-medium">City</th>
							<th scope="col" class="text-left px-4 py-3 text-zinc-400 font-medium">Ward</th>
							<th scope="col" class="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">Councillor</th>
							<th scope="col" class="text-right px-4 py-3">
								<button
									onclick={() => setSort('open')}
									class="text-zinc-400 font-medium hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
									aria-label="Sort by open holes{sortCol === 'open' ? `, currently ${sortAsc ? 'ascending' : 'descending'}` : ''}"
								>
									Open <span aria-hidden="true">{sortLabel('open')}</span>
								</button>
							</th>
							<th scope="col" class="text-right px-4 py-3">
								<button
									onclick={() => setSort('fillRate')}
									class="text-zinc-400 font-medium hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
									aria-label="Sort by fill rate{sortCol === 'fillRate' ? `, currently ${sortAsc ? 'ascending' : 'descending'}` : ''}"
								>
									Fill rate <span aria-hidden="true">{sortLabel('fillRate')}</span>
								</button>
							</th>
							<th scope="col" class="text-right px-4 py-3">
								<button
									onclick={() => setSort('avgDays')}
									class="text-zinc-400 font-medium hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
									aria-label="Sort by average days to fill{sortCol === 'avgDays' ? `, currently ${sortAsc ? 'ascending' : 'descending'}` : ''}"
								>
									Avg days <span aria-hidden="true">{sortLabel('avgDays')}</span>
								</button>
							</th>
						</tr>
					</thead>
					<tbody>
					{#each wardRows as row (row.key)}
							<tr class="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
								<td class="px-4 py-3 text-zinc-300 capitalize">{row.city}</td>
								<td class="px-4 py-3 text-zinc-300">Ward {row.ward}</td>
								<td class="px-4 py-3 hidden md:table-cell">
									{#if row.councillorUrl}
										<a
											href={row.councillorUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="text-sky-400 hover:text-sky-300 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
										>
											{row.councillorName}
										</a>
									{:else}
										<span class="text-zinc-500">{row.councillorName}</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-right font-semibold {row.open > 0 ? 'text-orange-400' : 'text-zinc-500'}">
									{row.open}
								</td>
								<td class="px-4 py-3 text-right text-sky-400">
									{row.total === 0 ? '—' : `${fmt(row.fillRate, 0)}%`}
								</td>
								<td class="px-4 py-3 text-right text-zinc-400">{fmt(row.avgDays, 1)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-xs text-zinc-600 mt-2">
				Click column headers to sort. Potholes outside mapped ward boundaries may be excluded.
			</p>
		{/if}
	</section>

	<!-- ── Worst offenders ────────────────────────────────────────────────────── -->
	<section aria-labelledby="offenders-heading">
		<h2 id="offenders-heading" class="flex items-center gap-2 text-lg font-semibold text-white mb-4">
			<Icon name="alert-triangle" size={18} class="text-red-400 shrink-0" />
			Longest-open unfilled holes
		</h2>

		{#if offenders.length === 0}
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-green-400 text-sm font-semibold flex items-center justify-center gap-2">
				<Icon name="check-circle" size={16} class="shrink-0" />
				No open potholes in this time window!
			</div>
		{:else}
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-zinc-800">
							<th scope="col" class="text-left px-4 py-3 text-zinc-400 font-medium">Location</th>
							<th scope="col" class="text-right px-4 py-3 text-zinc-400 font-medium">Days open</th>
							<th scope="col" class="text-right px-4 py-3 text-zinc-400 font-medium">Status</th>
						</tr>
					</thead>
					<tbody>
				{#each offenders as p (p.id)}
							<tr class="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
								<td class="px-4 py-3">
									<a
										href="/hole/{p.id}"
										class="text-sky-400 hover:text-sky-300 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
									>
										{p.lat.toFixed(4)}, {p.lng.toFixed(4)}
									</a>
								</td>
								<td
									class="px-4 py-3 text-right font-bold tabular-nums
										{p.days > 90 ? 'text-red-400' : p.days > 30 ? 'text-orange-400' : 'text-zinc-300'}"
									aria-label="{p.days} days open"
								>
									{p.days}
								</td>
								<td class="px-4 py-3 text-right">
									<span class="inline-flex items-center gap-1 text-orange-400 text-xs">
										<Icon name="map-pin" size={11} class="shrink-0" />
										Reported
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<p class="text-center text-xs text-zinc-700 pb-4">
		Data refreshes on each page load. Ward assignment computes client-side and may miss potholes near boundaries.
	</p>
</div>
