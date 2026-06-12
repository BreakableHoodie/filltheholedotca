<script lang="ts">
	import { format } from 'date-fns';
	import { UPDATES } from '$lib/updates';
</script>

<svelte:head>
	<title>What's new — FillTheHole.ca</title>
	<meta
		name="description"
		content="Recent updates and improvements to FillTheHole.ca, the community pothole tracker for Waterloo Region."
	/>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-12 space-y-10">
	<div>
		<h1 class="page-title text-4xl sm:text-5xl text-stone-900 dark:text-white mb-2">What's new</h1>
		<p class="page-intro text-stone-600 dark:text-stone-400 text-lg">
			Improvements we've shipped to the tracker. This is a community project, built in the open.
		</p>
	</div>

	<div class="space-y-8">
		{#each UPDATES as entry (entry.date + entry.title)}
			<section class="space-y-3">
				<div class="flex items-baseline justify-between gap-3 flex-wrap">
					<h2 class="section-title text-xl text-stone-900 dark:text-white">{entry.title}</h2>
					<time
						datetime={entry.date}
						class="text-xs font-medium text-stone-500 dark:text-stone-400 tabular-nums shrink-0"
					>
						{format(new Date(entry.date + 'T00:00:00'), 'MMM d, yyyy')}
					</time>
				</div>
				<ul class="space-y-2">
					{#each entry.items as item (item)}
						<li class="flex gap-2.5 text-stone-600 dark:text-stone-400 leading-relaxed">
							<span class="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true"></span>
							<span>{item}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>

	<p class="text-sm text-stone-500 dark:text-stone-400">
		Want the exact details? Everything is public on
		<a
			href="https://github.com/BreakableHoodie/filltheholedotca"
			target="_blank"
			rel="noopener noreferrer"
			class="underline hover:text-stone-700 dark:hover:text-stone-200 transition-colors">GitHub</a
		>.
	</p>
</div>
