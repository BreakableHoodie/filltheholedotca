<script lang="ts">
  import { format } from 'date-fns';
  import Icon from '$lib/components/Icon.svelte';
  import { wardGrade } from '$lib/ward-grade';
  import { getWardEmailUrl } from '$lib/email';
  import type { PageData } from './$types';
  import type { Pothole } from '$lib/types';

  let { data }: { data: PageData } = $props();
  let councillor = $derived(data.councillor);
  let wardPotholes = $derived(data.wardPotholes as Pothole[]);
  let origin = $derived(data.origin as string);
  let city = $derived(data.city as string);
  let ward = $derived(data.ward as number);

  // ── Derived stats ──────────────────────────────────────────────────────────
  let total    = $derived(wardPotholes.length);
  let filled   = $derived(wardPotholes.filter(p => p.status === 'filled').length);
  let open     = $derived(wardPotholes.filter(p => p.status === 'reported' || p.status === 'expired').length);
  let fillRate = $derived(total === 0 ? null : (filled / total) * 100);

  let avgDays = $derived.by(() => {
    const done = wardPotholes.filter(p => p.status === 'filled' && p.filled_at);
    if (!done.length) return null;
    const ms = done.reduce(
      (s, p) => s + new Date(p.filled_at!).getTime() - new Date(p.created_at).getTime(), 0
    );
    return ms / done.length / 86_400_000;
  });

  let grade = $derived(wardGrade(fillRate ?? 0, avgDays, total));

  // ── Monthly bar chart (last 12 months) ────────────────────────────────────
  let monthlyData = $derived.by(() => {
    const now = new Date();
    const keys: string[] = [];
    const months: Record<string, { label: string; reported: number; filled: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      keys.push(key);
      months[key] = { label: format(d, 'MMM yy'), reported: 0, filled: 0 };
    }
    for (const p of wardPotholes) {
      const rk = p.created_at.slice(0, 7);
      if (rk in months) months[rk].reported++;
      if (p.filled_at) {
        const fk = p.filled_at.slice(0, 7);
        if (fk in months) months[fk].filled++;
      }
    }
    return keys.map(k => ({ key: k, ...months[k] }));
  });

  let monthlyMax = $derived(
    Math.max(...monthlyData.map(m => Math.max(m.reported, m.filled)), 1)
  );

  // ── Open potholes list (oldest first, reported status only) ───────────────
  let openPotholes = $derived(
    wardPotholes
      .filter(p => p.status === 'reported')
      .map(p => ({
        ...p,
        days: Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000),
      }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 10)
  );

  let wardUrl = $derived(`${origin}/stats/ward/${city}/${ward}`);
  let emailUrl = $derived(getWardEmailUrl(councillor, fillRate, open, wardUrl));

  let cityLabel = $derived(
    city.charAt(0).toUpperCase() + city.slice(1)
  );
</script>

<svelte:head>
  <title>{councillor.name} · Ward {ward} — FillTheHole.ca</title>
  <meta property="og:title" content="{councillor.name} · Ward {ward} Accountability — FillTheHole.ca" />
  <meta property="og:description" content="Ward {ward} {cityLabel} pothole accountability: grade {grade.grade}, {fillRate !== null ? fillRate.toFixed(0) + '% fill rate' : 'no data yet'}. {open} open potholes." />
  <meta property="og:image" content="{origin}/api/og/ward/{city}/{ward}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="{origin}/stats/ward/{city}/{ward}" />
  <meta property="og:type" content="website" />
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-8 space-y-6">

  <!-- Back link -->
  <a href="/stats#ward-heading" class="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
    <Icon name="arrow-left" size={14} />
    All wards
  </a>

  <!-- Header: councillor + grade -->
  <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
    <div class="flex items-start gap-4">
      <div class="shrink-0 w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold text-xl select-none">
        {councillor.name.charAt(0)}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-zinc-500 uppercase tracking-wide">{cityLabel} · Ward {ward}</p>
        <h1 class="text-xl font-bold text-white mt-0.5">{councillor.name}</h1>
      </div>
      <div class="shrink-0">
        <span class="text-3xl font-extrabold {grade.color}">{grade.grade}</span>
        <p class="text-xs text-zinc-600 text-right mt-0.5">grade</p>
      </div>
    </div>
  </div>

  <!-- Stat pills -->
  <div class="grid grid-cols-3 gap-3">
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
      <p class="text-2xl font-bold text-white">{total}</p>
      <p class="text-xs text-zinc-500 mt-0.5">reported</p>
    </div>
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
      <p class="text-2xl font-bold text-green-400">{filled}</p>
      <p class="text-xs text-zinc-500 mt-0.5">filled</p>
    </div>
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
      <p class="text-2xl font-bold {open > 0 ? 'text-orange-400' : 'text-zinc-500'}">{open}</p>
      <p class="text-xs text-zinc-500 mt-0.5">open</p>
    </div>
  </div>

  <!-- Mini bar chart -->
  <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-semibold text-zinc-300">Monthly activity</h2>
      <div class="flex items-center gap-3 text-xs text-zinc-500">
        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-orange-500/70 inline-block"></span>Reported</span>
        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-green-500/70 inline-block"></span>Filled</span>
      </div>
    </div>
    <div class="flex items-end gap-px h-20" role="img" aria-label="Bar chart of monthly pothole reports and fills for this ward over the last 12 months">
      {#each monthlyData as m (m.key)}
        <div class="flex-1 flex flex-col items-stretch gap-px">
          <div class="flex items-end gap-px flex-1">
            <div class="flex-1 bg-orange-500/70 rounded-t-sm" style="height:{Math.round((m.reported / monthlyMax) * 72)}px" title="{m.reported} reported in {m.label}"></div>
            <div class="flex-1 bg-green-500/70 rounded-t-sm"  style="height:{Math.round((m.filled  / monthlyMax) * 72)}px" title="{m.filled} filled in {m.label}"></div>
          </div>
        </div>
      {/each}
    </div>
    <div class="flex gap-px mt-1.5" aria-hidden="true">
      {#each monthlyData as m, i (m.key)}
        <div class="flex-1 text-center min-w-0 overflow-hidden">
          {#if i % 3 === 0 || i === monthlyData.length - 1}
            <span class="text-zinc-600 text-[9px]">{m.label}</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Open potholes list -->
  <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
    <h2 class="text-sm font-semibold text-zinc-300">Open potholes in this ward</h2>
    {#if openPotholes.length === 0}
      <p class="text-zinc-500 text-sm">No open potholes in this ward right now.</p>
    {:else}
      <ul class="space-y-2">
        {#each openPotholes as p (p.id)}
          <li>
            <a
              href="/hole/{p.id}"
              class="flex items-center justify-between gap-3 text-sm hover:text-white transition-colors group"
            >
              <span class="text-zinc-300 group-hover:text-white truncate">
                {p.address || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
              </span>
              <span class="shrink-0 text-zinc-600 tabular-nums text-xs">{p.days}d</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Actions -->
  <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
    <h2 class="text-sm font-semibold text-zinc-300">Take action</h2>
    <div class="flex flex-wrap gap-2">
      <a
        href={emailUrl}
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

</div>
