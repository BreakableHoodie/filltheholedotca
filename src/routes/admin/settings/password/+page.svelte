<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data: _data, form }: Props = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Change Password — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6 max-w-md">
	<nav class="flex items-center gap-2 text-sm text-zinc-500 mb-5">
		<span class="text-zinc-300">Settings</span>
		<span>/</span>
		<span class="text-zinc-300">Change Password</span>
	</nav>

	<h1 class="text-xl font-semibold text-zinc-100 mb-6">Change Password</h1>

	{#if form?.success}
		<div class="mb-5 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
			Password updated successfully.
		</div>
	{/if}

	{#if form?.error}
		<div class="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
			{form.error}
		</div>
	{/if}

	<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
		<form
			method="post"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
			class="space-y-4"
		>
			<div>
				<label for="current" class="block text-xs text-zinc-500 mb-1.5">Current password</label>
				<input
					id="current"
					name="current"
					type="password"
					autocomplete="current-password"
					required
					class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
				/>
			</div>

			<div>
				<label for="password" class="block text-xs text-zinc-500 mb-1.5">New password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					minlength="12"
					required
					class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
				/>
				<p class="text-zinc-600 text-xs mt-1">At least 12 characters.</p>
			</div>

			<div>
				<label for="confirm" class="block text-xs text-zinc-500 mb-1.5">Confirm new password</label>
				<input
					id="confirm"
					name="confirm"
					type="password"
					autocomplete="new-password"
					minlength="12"
					required
					class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
				/>
			</div>

			<button
				type="submit"
				disabled={submitting}
				class="w-full py-2.5 text-sm font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
			>
				{submitting ? 'Updating…' : 'Update password'}
			</button>
		</form>
	</div>
</div>
