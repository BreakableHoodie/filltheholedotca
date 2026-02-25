<script lang="ts">
	import { page } from '$app/stores';
	import Icon from '$lib/components/Icon.svelte';
</script>

<svelte:head>
	<title>{$page.status} — FillTheHole.ca</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-20 text-center space-y-6">
	<div class="font-brand font-bold text-8xl text-zinc-800 tabular-nums select-none">
		{$page.status}
	</div>

	<div class="space-y-2">
		<h1 class="text-xl font-bold text-white">
			{#if $page.status === 404}
				Page not found
			{:else if $page.status >= 500}
				Something went wrong
			{:else}
				An error occurred
			{/if}
		</h1>
		<p class="text-zinc-400 text-sm">
			{#if $page.status === 404}
				This pothole might have been filled — or the link is broken.
			{:else}
				We hit a bump. Try again in a moment.
			{/if}
		</p>
	</div>

	<a
		href="/"
		class="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors text-sm"
	>
		<Icon name="arrow-left" size={14} class="shrink-0" />
		Back to map
	</a>
</div>
