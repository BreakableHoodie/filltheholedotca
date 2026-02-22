<script lang="ts">
	import { onMount, tick } from 'svelte';

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
			// Fallback: show modal if we can't determine state, or suppress error
			// Safety first: better to show it again than crash
			visible = true; 
		}
	});

	// Focus management: move focus into modal on open, restore on close
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

	// Trap focus inside the modal and handle Escape
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
</script>

{#if visible}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="welcome-title"
		tabindex="-1"
		onkeydown={handleKeydown}
		bind:this={dialogRef}
	>
		<div class="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
			<div class="text-center space-y-1">
				<div class="text-4xl mb-2">🕳️</div>
				<h2 id="welcome-title" class="text-xl font-bold text-white">Welcome to fillthehole.ca</h2>
				<p class="text-zinc-400 text-sm">Waterloo Region Pothole Tracker</p>
			</div>

			<div class="space-y-3 text-sm text-zinc-300 leading-relaxed">
				<p>
					Potholes damage vehicles, hurt cyclists, and go unfixed for months.
					This map tracks every reported pothole in Kitchener, Waterloo, and Cambridge —
					and whether the city has filled it.
				</p>

				<div class="grid gap-2">
					<div class="flex items-start gap-3 bg-zinc-800/60 rounded-lg p-3">
						<span class="text-lg mt-0.5">📍</span>
						<div>
							<div class="font-semibold text-white text-xs mb-0.5">Report</div>
							<p class="text-zinc-400 text-xs">Standing next to a pothole? Open the app, lock your GPS, and submit. Three independent reports puts it on the map.</p>
						</div>
					</div>
					<div class="flex items-start gap-3 bg-zinc-800/60 rounded-lg p-3">
						<span class="text-lg mt-0.5">🚩</span>
						<div>
							<div class="font-semibold text-white text-xs mb-0.5">Flag</div>
							<p class="text-zinc-400 text-xs">Verify a pothole is still there and file an official report with the city. Then mark it flagged here.</p>
						</div>
					</div>
					<div class="flex items-start gap-3 bg-zinc-800/60 rounded-lg p-3">
						<span class="text-lg mt-0.5">✅</span>
						<div>
							<div class="font-semibold text-white text-xs mb-0.5">Filled</div>
							<p class="text-zinc-400 text-xs">Once the city fills it, mark it done. Public accountability, one hole at a time.</p>
						</div>
					</div>
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
