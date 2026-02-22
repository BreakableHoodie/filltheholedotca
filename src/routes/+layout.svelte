<script lang="ts">
	import '../app.css';
	import { Toaster } from 'svelte-sonner';
	import WelcomeModal from '$lib/components/WelcomeModal.svelte';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	let counts = $state({ reported: 0, flagged: 0, filled: 0 });

	async function fetchCounts() {
		const { data } = await supabase.from('potholes').select('status');
		if (data) {
			counts.reported = data.filter((p) => p.status === 'reported').length;
			counts.flagged = data.filter((p) => p.status === 'wanksyd').length;
			counts.filled = data.filter((p) => p.status === 'filled').length;
		}
	}

	onMount(fetchCounts);

	let { children } = $props();
</script>

<svelte:head>
	<title>FillTheHole.ca — Waterloo Region Pothole Tracker</title>
</svelte:head>

<div class="flex flex-col min-h-screen bg-zinc-950">
	<!-- Skip link: must be the first focusable element for keyboard/screen reader users -->
	<a
		href="#maincontent"
		class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-sky-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
	>
		Skip to main content
	</a>

	<header class="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50 safe-header">
			<div class="max-w-6xl mx-auto py-3 safe-header-inner">
			<div class="flex items-center justify-between gap-3 flex-wrap">
				<a href="/" class="flex items-center gap-2 group">
					<span class="text-2xl">🕳️</span>
					<span class="font-bold text-xl tracking-tight text-white group-hover:text-sky-400 transition-colors">
						FillTheHole<span class="text-sky-500">.ca</span>
					</span>
				</a>

				<div class="hidden sm:flex items-center gap-3 text-sm" aria-label="Pothole statistics">
					<span class="text-zinc-400">
						🕳️ <span class="text-white font-semibold">{counts.reported + counts.flagged + counts.filled}</span> reported
					</span>
					<span class="text-zinc-600" aria-hidden="true">·</span>
					<span class="text-zinc-400">
						🚩 <span class="text-white font-semibold">{counts.flagged}</span> flagged
					</span>
					<span class="text-zinc-600" aria-hidden="true">·</span>
					<span class="text-zinc-400">
						✅ <span class="text-white font-semibold">{counts.filled}</span> filled
					</span>
				</div>

				<nav class="flex items-center gap-3 text-sm">
					<a href="/stats" class="text-zinc-400 hover:text-white transition-colors">
						Stats
					</a>
					<a href="/about" class="text-zinc-400 hover:text-white transition-colors">
						About
					</a>
					<a
						href="/report"
						class="bg-sky-700 hover:bg-sky-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
					>
						+ Report a pothole
					</a>
				</nav>
			</div>
		</div>
	</header>

	<main id="maincontent" tabindex="-1" class="flex-1">
		{@render children()}
	</main>

	<footer class="bg-zinc-900 border-t border-zinc-800 py-5 text-center text-zinc-400 text-xs px-4 space-y-1.5">
		<p>Track potholes. Contact your councillor. Hold the city accountable.</p>
		<p>
			Community-sourced data — not official. Use at your own risk.
			<a href="/about#privacy" class="underline hover:text-white transition-colors">Privacy</a>
			<span class="mx-1 text-zinc-600" aria-hidden="true">·</span>
			<a href="/about#disclaimer" class="underline hover:text-white transition-colors">Disclaimer</a>
			<span class="mx-1 text-zinc-600" aria-hidden="true">·</span>
			<a href="https://github.com/BreakableHoodie/filltheholedotca" target="_blank" rel="noopener noreferrer" class="underline hover:text-white transition-colors">GitHub</a>
		</p>
	</footer>
</div>

<Toaster richColors position="bottom-center" />
<WelcomeModal />
