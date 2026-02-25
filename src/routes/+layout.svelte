<script lang="ts">
	import '../app.css';
	import { Toaster } from 'svelte-sonner';
	import WelcomeModal from '$lib/components/WelcomeModal.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	let counts = $derived(data.counts);
</script>

<svelte:head>
	<title>FillTheHole.ca — Waterloo Region Pothole Tracker</title>
</svelte:head>

<div class="flex flex-col min-h-screen bg-zinc-950">
	<!-- Skip link: must be the first focusable element for keyboard/screen reader users -->
	<a
		href="#maincontent"
		class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-sky-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:outline-none"
	>
		Skip to main content
	</a>

	<header class="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50 safe-header">
		<div class="max-w-6xl mx-auto py-3 safe-header-inner">
			<div class="flex items-center justify-between gap-3 flex-wrap">
				<!-- Logo mark + wordmark -->
				<a href="/" class="flex items-center gap-2.5 group">
					<!-- Pothole icon: concentric rings suggest depth/crater -->
					<svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="shrink-0">
						<circle cx="13" cy="13" r="12" fill="#f97316"/>
						<circle cx="13" cy="13" r="7.5" fill="#09090b"/>
						<circle cx="13" cy="13" r="4" fill="rgba(249,115,22,0.15)"/>
					</svg>
					<span class="font-brand font-bold text-xl leading-none text-white group-hover:text-sky-400 transition-colors">
						FillTheHole<span class="text-sky-500">.ca</span>
					</span>
				</a>

				<!-- Live stat dots -->
				<div class="hidden sm:flex items-center gap-3 text-sm" aria-label="Pothole statistics">
					<span class="flex items-center gap-1.5 text-zinc-400">
						<span class="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
						<span class="text-white font-semibold tabular-nums">{counts.reported + counts.flagged + counts.filled}</span>
						reported
					</span>
					<span class="text-zinc-700" aria-hidden="true">·</span>
					<span class="flex items-center gap-1.5 text-zinc-400">
						<span class="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
						<span class="text-white font-semibold tabular-nums">{counts.flagged}</span>
						flagged
					</span>
					<span class="text-zinc-700" aria-hidden="true">·</span>
					<span class="flex items-center gap-1.5 text-zinc-400">
						<span class="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
						<span class="text-white font-semibold tabular-nums">{counts.filled}</span>
						filled
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
						href="https://github.com/BreakableHoodie/filltheholedotca"
						target="_blank"
						rel="noopener noreferrer"
						class="hidden sm:inline-flex text-zinc-400 hover:text-white transition-colors"
						aria-label="View source on GitHub"
					>
						<Icon name="github" size={18} />
					</a>
					<a
						href="/report"
						class="inline-flex items-center gap-1.5 bg-sky-700 hover:bg-sky-600 text-white font-semibold px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap text-sm"
					>
						<Icon name="plus" size={14} strokeWidth={2.5} />
						Report a hole
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
