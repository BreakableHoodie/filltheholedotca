<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	let visible = $state(false);
	let dialogRef = $state<HTMLDivElement | null>(null);
	let primaryButtonRef = $state<HTMLButtonElement | null>(null);
	let previousFocus: HTMLElement | null = null;

	onMount(() => {
		try {
			if (!localStorage.getItem('fth-welcomed')) {
				visible = true;
			}
		} catch (e) {
			console.error('Failed to access localStorage:', e);
			visible = true;
		}
	});

	$effect(() => {
		if (visible) {
			previousFocus = document.activeElement as HTMLElement | null;
			tick().then(() => primaryButtonRef?.focus());
		} else {
			previousFocus?.focus();
			previousFocus = null;
		}
	});

	function dismiss() {
		try {
			localStorage.setItem('fth-welcomed', '1');
		} catch (e) {
			console.error('Failed to save to localStorage:', e);
		}
		visible = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			dismiss();
			return;
		}
		if (e.key !== 'Tab' || !dialogRef) return;

		const focusable = Array.from(
			dialogRef.querySelectorAll<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])')
		).filter((el) => !el.hasAttribute('disabled'));
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	const STEPS = [
		{
			icon: 'map-pin' as const,
			iconClass: 'text-orange-400',
			bgClass: 'bg-orange-500/10',
			title: 'Report',
			desc: 'Standing next to a pothole? Open the app, lock your GPS, and submit. Three independent reports puts it on the map.',
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
	<div
		class="fixed inset-0 bg-black/75 backdrop-blur-sm z-[2000] flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="welcome-title"
		tabindex="-1"
		onkeydown={handleKeydown}
		bind:this={dialogRef}
	>
		<div class="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
			<!-- Logo + heading -->
			<div class="text-center space-y-2">
				<div class="flex justify-center mb-3">
					<svg width="48" height="48" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<circle cx="13" cy="13" r="12" fill="#f97316"/>
						<circle cx="13" cy="13" r="7.5" fill="#09090b"/>
						<circle cx="13" cy="13" r="4" fill="rgba(249,115,22,0.15)"/>
					</svg>
				</div>
				<h2 id="welcome-title" class="font-brand font-bold text-2xl text-white">Welcome to FillTheHole.ca</h2>
				<p class="text-zinc-400 text-sm">Waterloo Region Pothole Tracker</p>
			</div>

			<div class="space-y-3 text-sm text-zinc-300 leading-relaxed">
				<p>
					Potholes damage vehicles, hurt cyclists, and go unfixed for months.
					This map tracks every reported pothole in Kitchener, Waterloo, and Cambridge —
					and whether the city has filled it.
				</p>

				<div class="grid gap-2">
					{#each STEPS as step (step.title)}
						<div class="flex items-start gap-3 bg-zinc-800/60 rounded-lg p-3">
							<div class="shrink-0 mt-0.5 p-1.5 rounded-md {step.bgClass}">
								<Icon name={step.icon} size={15} class={step.iconClass} />
							</div>
							<div>
								<div class="font-semibold text-white text-xs mb-0.5">{step.title}</div>
								<p class="text-zinc-400 text-xs">{step.desc}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-2">
				<button
					bind:this={primaryButtonRef}
					onclick={dismiss}
					class="w-full py-3 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded-xl transition-colors"
				>
					Show me the map
				</button>
				<a
					href="/about"
					onclick={dismiss}
					class="text-center text-zinc-400 hover:text-white text-xs transition-colors"
				>
					Learn more →
				</a>
			</div>
		</div>
	</div>
{/if}
