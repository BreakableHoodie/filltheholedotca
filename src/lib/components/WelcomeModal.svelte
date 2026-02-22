<script lang="ts">
	import { onMount } from 'svelte';

	let visible = $state(false);

	onMount(() => {
		if (!localStorage.getItem('fth-welcomed')) {
			visible = true;
		}
	});

	function dismiss() {
		localStorage.setItem('fth-welcomed', '1');
		visible = false;
	}
</script>

{#if visible}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="welcome-title"
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
					onclick={dismiss}
					class="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-colors"
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
