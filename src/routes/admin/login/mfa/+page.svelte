<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();
	let submitting = $state(false);
	let useBackupCode = $state(false);
	let code = $state('');
	let formEl: HTMLFormElement | undefined = $state();

	// Auto-submit on 6 digits in TOTP mode
	$effect(() => {
		if (!useBackupCode && code.length === 6 && /^\d{6}$/.test(code) && !submitting) {
			formEl?.requestSubmit();
		}
	});
</script>

<svelte:head>
	<title>Two-factor authentication — fillthehole.ca Admin</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="text-center mb-8">
			<p class="text-sky-400 font-bold text-xl">fillthehole.ca</p>
			<p class="text-zinc-500 text-sm mt-1">Admin Panel</p>
		</div>

		<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
			<h1 class="text-lg font-semibold text-zinc-100 mb-1">
				{useBackupCode ? 'Enter backup code' : 'Two-factor authentication'}
			</h1>
			<p class="text-zinc-500 text-sm mb-5">
				{useBackupCode
					? 'Enter one of your 8-character backup codes.'
					: 'Enter the 6-digit code from your authenticator app.'}
			</p>

			{#if form?.error}
				<div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
					{form.error}
				</div>
			{/if}

			<form
				bind:this={formEl}
				method="post"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<input type="hidden" name="token" value={data.token} />
				<input type="hidden" name="next" value={data.next} />

				<div class="mb-4">
					{#if useBackupCode}
						<label for="code" class="block text-xs font-medium text-zinc-400 mb-1.5"
							>Backup code</label
						>
						<input
							id="code"
							name="code"
							type="text"
							bind:value={code}
							required
							autocomplete="one-time-code"
							spellcheck="false"
							maxlength="8"
							class="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 font-mono tracking-widest uppercase transition-colors"
							placeholder="XXXXXXXX"
						/>
					{:else}
						<label for="code" class="block text-xs font-medium text-zinc-400 mb-1.5"
							>Authenticator code</label
						>
						<input
							id="code"
							name="code"
							type="text"
							bind:value={code}
							required
							inputmode="numeric"
							autocomplete="one-time-code"
							maxlength="6"
							class="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded text-2xl text-center text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 font-mono tracking-[0.5em] transition-colors"
							placeholder="000000"
						/>
					{/if}
				</div>

				<label class="flex items-center gap-2 cursor-pointer mb-4">
					<input
						type="checkbox"
						name="rememberDevice"
						class="rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-sky-500 focus:ring-offset-zinc-900 focus:ring-1"
					/>
					<span class="text-sm text-zinc-400">Remember this device for 30 days</span>
				</label>

				<button
					type="submit"
					disabled={submitting}
					class="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
				>
					{submitting ? 'Verifying…' : 'Verify'}
				</button>
			</form>

			<button
				type="button"
				onclick={() => {
					useBackupCode = !useBackupCode;
					code = '';
				}}
				class="mt-3 w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
			>
				{useBackupCode ? 'Use authenticator code instead' : 'Use a backup code instead'}
			</button>

			<div class="mt-3 pt-3 border-t border-zinc-800">
				<a
					href="/admin/login"
					class="block text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
				>
					← Back to sign in
				</a>
			</div>
		</div>
	</div>
</div>
