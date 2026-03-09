<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const threshold = $derived(
		parseInt(data.settings['confirmation_threshold']?.value ?? '2', 10)
	);
	const thresholdUpdatedAt = $derived(data.settings['confirmation_threshold']?.updated_at ?? null);

	// Pushover toggles — default true if not yet seeded in DB
	const pushoverEnabled = $derived(
		(data.settings['pushover_enabled']?.value ?? 'true') === 'true'
	);
	const pushoverNotifyPhotos = $derived(
		(data.settings['pushover_notify_photos']?.value ?? 'true') === 'true'
	);
	const pushoverNotifyCommunity = $derived(
		(data.settings['pushover_notify_community']?.value ?? 'true') === 'true'
	);
	const pushoverNotifySecurity = $derived(
		(data.settings['pushover_notify_security']?.value ?? 'true') === 'true'
	);

	let thresholdInputEl = $state<HTMLInputElement | null>(null);

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString('en-CA', {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}
</script>

<svelte:head>
	<title>Site Settings — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6 max-w-2xl space-y-6">
	<div>
		<h1 class="text-xl font-semibold text-zinc-100">Site Settings</h1>
		<p class="text-zinc-500 text-sm mt-0.5">App-wide configuration. Changes take effect immediately.</p>
	</div>

	{#if form?.error}
		<div class="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
			{form.error}
		</div>
	{/if}

	<!-- Confirmation threshold -->
	<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
		<div class="mb-4">
			<h2 class="text-sm font-medium text-zinc-200">Confirmation threshold</h2>
			<p class="text-zinc-500 text-xs mt-1 leading-relaxed">
				How many independent reports from distinct IPs are required before a pothole goes live on
				the public map. Raise this when data quality is high and engagement is strong; lower it
				when you want more potholes to surface quickly.
			</p>
			{#if thresholdUpdatedAt}
				<p class="text-zinc-700 text-xs mt-1">Last changed: {formatDate(thresholdUpdatedAt)}</p>
			{/if}
		</div>

		<form
			method="post"
			action="?/updateSetting"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success') {
						toast.success('Setting saved');
					} else if (result.type === 'failure') {
						toast.error((result.data as { error?: string })?.error ?? 'Failed to save');
					}
				};
			}}
			class="flex items-end gap-3"
		>
			<input type="hidden" name="key" value="confirmation_threshold" />
			<div>
				<label for="threshold" class="block text-xs text-zinc-500 mb-1.5">
					Reports required
				</label>
				<input
					bind:this={thresholdInputEl}
					id="threshold"
					name="value"
					type="number"
					value={threshold}
					min="1"
					max="20"
					class="w-24 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 tabular-nums"
				/>
			</div>
			<button
				type="submit"
				class="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
			>
				Save
			</button>
		</form>

		<div class="mt-4 pt-4 border-t border-zinc-800">
			<p class="text-zinc-600 text-xs">
				Current value: <span class="text-zinc-400 font-medium tabular-nums">{threshold}</span>
				confirmation{threshold !== 1 ? 's' : ''} required
			</p>
			<div class="flex gap-3 mt-2 flex-wrap">
				{#each [1, 2, 3, 5] as preset (preset)}
					<button
						type="button"
						onclick={() => { if (thresholdInputEl) thresholdInputEl.value = String(preset); }}
						class="text-xs px-2 py-0.5 rounded border transition-colors
						       {threshold === preset
							? 'border-sky-500/50 text-sky-400 bg-sky-500/10'
							: 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'}"
					>
						{preset}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Pushover notifications -->
	<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
		<div>
			<h2 class="text-sm font-medium text-zinc-200">Pushover notifications</h2>
			<p class="text-zinc-500 text-xs mt-1 leading-relaxed">
				Controls whether push notifications are sent via Pushover. The master switch must be on
				for any notifications to fire. Individual categories can be muted independently.
				Credentials (<code class="text-zinc-400">PUSHOVER_APP_TOKEN</code> /
				<code class="text-zinc-400">PUSHOVER_USER_KEY</code>) must still be set in the environment.
			</p>
		</div>

		<!-- Master toggle -->
		{@render toggle('pushover_enabled', pushoverEnabled, 'All notifications', 'Send any Pushover notification')}

		<!-- Per-category toggles -->
		<div class="pl-4 border-l border-zinc-800 space-y-3" class:opacity-40={!pushoverEnabled} class:pointer-events-none={!pushoverEnabled}>
			{@render toggle('pushover_notify_photos', pushoverNotifyPhotos, 'Photo uploads', 'New photos awaiting moderation, including deferred reviews when SightEngine is down')}
			{@render toggle('pushover_notify_community', pushoverNotifyCommunity, 'Community events', 'Pothole confirmed and live, pothole marked filled')}
			{@render toggle('pushover_notify_security', pushoverNotifySecurity, 'Security & logins', 'Admin login events and login rate-limit alerts')}
		</div>
	</div>
</div>

{#snippet toggle(key: string, current: boolean, label: string, description: string)}
	<form
		method="post"
		action="?/updateSetting"
		use:enhance={() => {
			return async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success') {
					toast.success(`${label} ${current ? 'disabled' : 'enabled'}`);
				} else if (result.type === 'failure') {
					toast.error((result.data as { error?: string })?.error ?? 'Failed to save');
				}
			};
		}}
	>
		<input type="hidden" name="key" value={key} />
		<input type="hidden" name="value" value={current ? 'false' : 'true'} />
		<button
			type="submit"
			class="w-full flex items-center justify-between gap-4 py-2 text-left group"
		>
			<div>
				<p class="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">{label}</p>
				<p class="text-xs text-zinc-600 leading-relaxed">{description}</p>
			</div>
			<!-- Toggle pill -->
			<div
				class="relative shrink-0 w-10 h-5 rounded-full transition-colors {current
					? 'bg-sky-600'
					: 'bg-zinc-700'}"
			>
				<div
					class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform {current
						? 'translate-x-5'
						: 'translate-x-0'}"
				></div>
			</div>
		</button>
	</form>
{/snippet}
