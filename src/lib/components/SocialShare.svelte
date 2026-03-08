<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { compact = false }: { compact?: boolean } = $props();

	const SITE_URL = 'https://fillthehole.ca';
	const SHARE_TEXT = encodeURIComponent(
		'Track potholes in Waterloo Region, Ontario 🕳️ — fillthehole.ca'
	);
	const SHARE_URL = encodeURIComponent(SITE_URL);

	const platforms = [
		{
			name: 'Reddit',
			href: `https://www.reddit.com/submit?url=${SHARE_URL}&title=${SHARE_TEXT}`,
			hoverClass: 'hover:border-orange-500/40 hover:text-orange-400'
		},
		{
			name: 'Facebook',
			href: `https://www.facebook.com/sharer/sharer.php?u=${SHARE_URL}`,
			hoverClass: 'hover:border-blue-500/40 hover:text-blue-400'
		},
		{
			name: 'Bluesky',
			href: `https://bsky.app/intent/compose?text=${SHARE_TEXT}`,
			hoverClass: 'hover:border-sky-500/40 hover:text-sky-400'
		},
		{
			name: 'Threads',
			href: `https://www.threads.net/intent/post?text=${SHARE_TEXT}`,
			hoverClass: 'hover:border-zinc-400/40 hover:text-zinc-200'
		},
		{
			name: 'LinkedIn',
			href: `https://www.linkedin.com/sharing/share-offsite/?url=${SHARE_URL}`,
			hoverClass: 'hover:border-blue-400/40 hover:text-blue-300'
		}
	] as const;

	let canNativeShare = $state(false);
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		canNativeShare = 'share' in navigator;
	});

	onDestroy(() => {
		clearTimeout(copyTimer);
	});

	async function nativeShare() {
		try {
			await navigator.share({
				title: 'FillTheHole.ca',
				text: 'Track potholes in Waterloo Region, Ontario 🕳️',
				url: SITE_URL
			});
		} catch {
			// User cancelled or share failed — not an error worth surfacing
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(SITE_URL);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// Clipboard access denied — silently ignore
		}
	}
</script>

{#if compact}
	<!-- Footer variant: plain text links matching footer style -->
	<span>
		Spread the word:
		{#each platforms as p, i (p.name)}
			<a
				href={p.href}
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-white transition-colors"
			>
				{p.name}
			</a>
			{#if i < platforms.length - 1}
				<span class="mx-1 text-zinc-600" aria-hidden="true">·</span>
			{/if}
		{/each}
	</span>
{:else}
	<!-- About page variant: pill buttons + copy link + native share -->
	<div class="flex flex-wrap gap-2">
		{#each platforms as p (p.name)}
			<a
				href={p.href}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300 transition-colors {p.hoverClass}"
			>
				{p.name}
				<Icon name="external-link" size={13} class="shrink-0 opacity-60" />
			</a>
		{/each}
		<!-- aria-live announces the "Copied!" state change to screen readers -->
		<span class="sr-only" aria-live="polite">{copied ? 'Link copied to clipboard' : ''}</span>
		<button
			type="button"
			onclick={copyLink}
			class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
		>
			{#if copied}
				<Icon name="check" size={13} class="shrink-0 text-green-400" />
				<span class="text-green-400">Copied!</span>
			{:else}
				<Icon name="clipboard" size={13} class="shrink-0" />
				Copy link
			{/if}
		</button>
		{#if canNativeShare}
			<button
				type="button"
				onclick={nativeShare}
				class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-sky-700 hover:bg-sky-600 border border-sky-600 text-white transition-colors"
			>
				<Icon name="share-2" size={13} class="shrink-0" />
				Share
			</button>
		{/if}
	</div>
{/if}
