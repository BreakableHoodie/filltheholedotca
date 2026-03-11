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

	const STEPS = [
		{
			icon: 'map-pin' as const,
			iconClass: 'text-orange-400',
			bgClass: 'bg-orange-500/10',
			title: 'Report',
			desc: 'Standing next to a pothole? Open the app, confirm the location, and submit. Independent reports from nearby residents put it on the public map.',
		},
		{
			icon: 'mail' as const,
			iconClass: 'text-sky-400',
			bgClass: 'bg-sky-500/10',
			title: 'Contact',
			desc: 'Share the link or email your ward councillor directly from the pothole page. The more people who see it, the harder it is to ignore.',
		},
		{
			icon: 'check-circle' as const,
			iconClass: 'text-green-400',
			bgClass: 'bg-green-500/10',
			title: 'Filled',
			desc: 'Once the city fills it, mark it done. Public accountability, one hole at a time.',
		},
	] as const;
</script>

{#if visible}
	<section
		aria-labelledby="welcome-title"
		class="absolute top-4 left-4 right-4 z-[1001] sm:left-6 sm:right-auto sm:max-w-md"
	>
		<div class="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl">
			<div class="flex items-start justify-between gap-3">
				<div class="space-y-2">
					<p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">Waterloo Region civic tool</p>
					<h2 id="welcome-title" class="font-brand font-bold text-3xl leading-none text-white">Report a pothole in about 30 seconds</h2>
					<p class="text-sm text-zinc-300 leading-relaxed">
						Independent community tracker for Kitchener, Waterloo, and Cambridge.
						No account required.
					</p>
				</div>
				<button
					type="button"
					onclick={dismiss}
					class="rounded-lg p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
					aria-label="Dismiss introduction"
				>
					<Icon name="x" size={16} />
				</button>
			</div>

			<div class="mt-4 grid gap-2">
				{#each STEPS as step (step.title)}
					<div class="flex items-start gap-3 bg-zinc-900 rounded-xl p-3">
						<div class="shrink-0 mt-0.5 p-1.5 rounded-md {step.bgClass}">
							<Icon name={step.icon} size={15} class={step.iconClass} />
						</div>
						<div>
							<div class="font-semibold text-white text-xs mb-0.5">{step.title}</div>
							<p class="text-zinc-400 text-xs leading-relaxed">{step.desc}</p>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-4 flex flex-col sm:flex-row gap-2">
				<a
					href="/report"
					onclick={dismiss}
					class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-600"
				>
					<Icon name="map-pin" size={15} class="shrink-0" />
					Report a pothole
				</a>
				<a
					href="/about"
					onclick={dismiss}
					class="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
				>
					Learn how it works
				</a>
			</div>

			<p class="mt-3 text-xs text-zinc-400">
				Community-run and open source. For official action, report to the city too.
			</p>
		</div>
	</section>
{/if}
