<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { onMount } from 'svelte';

	let visible = $state(false);

	onMount(() => {
		try {
			if (!localStorage.getItem('fth-home-intro-dismissed')) {
				visible = true;
			}
		} catch (e) {
			console.error('Failed to access localStorage:', e);
			visible = true;
		}
	});

	function dismiss() {
		try {
			localStorage.setItem('fth-home-intro-dismissed', '1');
		} catch (e) {
			console.error('Failed to save to localStorage:', e);
		}
		visible = false;
	}

</script>

{#if visible}
	<section
		aria-labelledby="welcome-title"
		class="absolute top-4 left-4 right-4 z-[1001] sm:left-6 sm:right-auto sm:max-w-md"
	>
		<div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md p-5 shadow-xl">
			<div class="flex items-start justify-between gap-3">
				<div class="space-y-2">
					<p class="text-xs font-semibold text-stone-500 dark:text-stone-400">Waterloo Region civic tool</p>
					<h2 id="welcome-title" class="page-title text-3xl text-stone-900 dark:text-white">Report a pothole in about 30 seconds</h2>
					<p class="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
						Independent community tracker for Kitchener, Waterloo, and Cambridge.
						No account required.
					</p>
				</div>
				<button
					type="button"
					onclick={dismiss}
					class="rounded-md p-2 text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
					aria-label="Dismiss introduction"
				>
					<Icon name="x" size={16} />
				</button>
			</div>

			<ol class="mt-4 space-y-3 text-sm">
				<li class="flex gap-3 items-start border-l-2 border-amber-500 pl-3">
					<div>
						<span class="font-semibold text-stone-900 dark:text-white">Report</span>
						<span class="text-stone-500 dark:text-stone-400"> — confirm the location and submit. Nearby reports are merged.</span>
					</div>
				</li>
				<li class="flex gap-3 items-start border-l-2 border-amber-500 pl-3">
					<div>
						<span class="font-semibold text-stone-900 dark:text-white">Contact</span>
						<span class="text-stone-500 dark:text-stone-400"> — email your ward councillor directly from the pothole page.</span>
					</div>
				</li>
				<li class="flex gap-3 items-start border-l-2 border-amber-500 pl-3">
					<div>
						<span class="font-semibold text-stone-900 dark:text-white">Track</span>
						<span class="text-stone-500 dark:text-stone-400"> — once the city fills it, mark it done.</span>
					</div>
				</li>
			</ol>

			<div class="mt-4 flex flex-col sm:flex-row gap-2">
				<a
					href="/report"
					onclick={dismiss}
					class="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-600"
				>
					Report a pothole
				</a>
				<a
					href="/about"
					onclick={dismiss}
					class="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 dark:border-stone-600 px-4 py-3 text-sm font-semibold text-stone-700 dark:text-stone-300 transition-colors hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white"
				>
					Learn how it works
				</a>
			</div>

			<p class="mt-3 text-xs text-stone-500 dark:text-stone-400">
				Community-run and open source. For official action, report to the city too.
			</p>
		</div>
	</section>
{/if}
