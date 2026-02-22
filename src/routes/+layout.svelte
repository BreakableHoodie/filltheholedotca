<script lang="ts">
	import WelcomeModal from '$lib/components/WelcomeModal.svelte';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import '../app.css';

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
					<a href="/about" class="text-zinc-400 hover:text-white transition-colors">
						About
					</a>
					<a
						href="https://github.com/BreakableHoodie/filltheholedotca"
						target="_blank"
						rel="noopener noreferrer"
						class="text-zinc-400 hover:text-white transition-colors"
						aria-label="View source on GitHub"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
							<path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
						</svg>
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
			<span class="mx-1 text-zinc-600" aria-hidden="true">·</span>
			<a href="https://github.com/BreakableHoodie/filltheholedotca/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" class="underline hover:text-white transition-colors">AGPL-3.0</a>
		</p>
	</footer>
</div>

<Toaster richColors position="bottom-center" />
<WelcomeModal />
