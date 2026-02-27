<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let showRegenForm = $state(false);
	// Extracted to avoid TypeScript narrowing to 'never' inside {#if form?.pendingSetup} && {#if form?.error}
	const pendingSetupError = $derived(form && 'error' in form ? (form as { error: string }).error : null);

	function formatCode(code: string): string {
		// ABCDEFGH → ABCD EFGH for readability
		return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
	}
</script>

<svelte:head>
	<title>Two-Factor Auth — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6 max-w-2xl">
	<nav class="flex items-center gap-2 text-sm text-zinc-500 mb-5">
		<span class="text-zinc-300">Settings</span>
		<span>/</span>
		<span class="text-zinc-300">Two-Factor Auth</span>
	</nav>

	<h1 class="text-xl font-semibold text-zinc-100 mb-6">Two-Factor Authentication</h1>

	{#if form?.error && !form?.pendingSetup}
		<div class="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
			{form.error}
		</div>
	{/if}

	<!-- ─── Just confirmed: show backup codes ─── -->
	{#if form?.confirmed && form.backupCodes}
		<div class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5 mb-5">
			<h2 class="text-emerald-400 font-semibold mb-1">MFA enabled!</h2>
			<p class="text-zinc-300 text-sm mb-4">
				Save these backup codes somewhere safe. Each can only be used once if you lose access to
				your authenticator.
			</p>
			<div class="grid grid-cols-2 gap-2">
				{#each form.backupCodes as code (code)}
					<code class="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-200 text-center">
						{formatCode(code)}
					</code>
				{/each}
			</div>
			<p class="text-zinc-500 text-xs mt-3">These codes are shown once and cannot be retrieved later.</p>
		</div>

	<!-- ─── Just regenerated backup codes ─── -->
	{:else if form?.newBackupCodes}
		<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-5 mb-5">
			<h2 class="text-amber-400 font-semibold mb-1">New backup codes</h2>
			<p class="text-zinc-300 text-sm mb-4">Your old codes are now invalid. Save these new ones.</p>
			<div class="grid grid-cols-2 gap-2">
				{#each form.newBackupCodes as code (code)}
					<code class="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-200 text-center">
						{formatCode(code)}
					</code>
				{/each}
			</div>
		</div>

	<!-- ─── MFA disabled this session ─── -->
	{:else if form?.disabled}
		<div class="mb-5 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm">
			MFA has been disabled on your account.
		</div>
	{/if}

	<!-- ─── Pending setup: show secret + confirm form ─── -->
	{#if form?.pendingSetup}
		<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
			<div>
				<h2 class="text-sm font-medium text-zinc-300 mb-1">Scan or enter your secret</h2>
				<p class="text-zinc-500 text-xs mb-3">
					Open your authenticator app and add a new TOTP account using the secret below,
					or use the URI to import it directly.
				</p>

				<div class="space-y-2">
					<div>
						<p class="text-zinc-500 text-xs mb-1">Secret key</p>
						<code class="block bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 break-all select-all">
							{form.displaySecret ?? ''}
						</code>
					</div>
					{#if form.totpUri}
						<details class="group">
							<summary class="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
								Show TOTP URI
							</summary>
							<code class="block mt-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-400 break-all select-all">
								{form.totpUri}
							</code>
						</details>
					{/if}
				</div>
			</div>

			<form method="post" action="?/confirmMfa" use:enhance class="space-y-3">
				<input type="hidden" name="encryptedSecret" value={form.encryptedSecret ?? ''} />
				<div>
					<label for="code" class="block text-xs text-zinc-500 mb-1.5">
						Verify — enter the 6-digit code from your app
					</label>
					{#if pendingSetupError}
						<p class="text-red-400 text-xs mb-1.5">{pendingSetupError}</p>
					{/if}
					<input
						id="code"
						name="code"
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						maxlength="6"
						placeholder="000000"
						class="w-32 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 font-mono text-center focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
					/>
				</div>
				<div class="flex items-center gap-3">
					<button
						type="submit"
						class="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
					>
						Verify & Enable
					</button>
					<a href="/admin/settings/mfa" class="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
						Cancel
					</a>
				</div>
			</form>
		</div>

	<!-- ─── MFA not enabled, no pending setup ─── -->
	{:else if !data.totpEnabled && !form?.confirmed}
		<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
			<div class="flex items-start gap-3 mb-4">
				<div class="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
					<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				</div>
				<div>
					<p class="text-zinc-200 font-medium">MFA is not enabled</p>
					<p class="text-zinc-500 text-sm mt-0.5">Add a second factor to protect your account.</p>
				</div>
			</div>
			<form method="post" action="?/initMfa" use:enhance>
				<button
					type="submit"
					class="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
				>
					Set up authenticator app
				</button>
			</form>
		</div>

	<!-- ─── MFA enabled ─── -->
	{:else if data.totpEnabled || form?.confirmed}
		<div class="space-y-4">
			<!-- Status card -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
						<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
						</svg>
					</div>
					<div>
						<p class="text-zinc-200 font-medium">MFA is enabled</p>
						<p class="text-zinc-500 text-sm mt-0.5">Your account is protected with TOTP.</p>
					</div>
				</div>

				<!-- Disable form -->
				<details class="group">
					<summary class="text-xs text-zinc-500 cursor-pointer hover:text-red-400 transition-colors">
						Disable MFA…
					</summary>
					<form method="post" action="?/disableMfa" use:enhance class="mt-3 space-y-2">
						<label for="disable-code" class="block text-xs text-zinc-500">
							Enter your TOTP or backup code to confirm
						</label>
						<div class="flex items-center gap-2">
							<input
								id="disable-code"
								name="code"
								type="text"
								inputmode="numeric"
								autocomplete="one-time-code"
								maxlength="8"
								placeholder="000000"
								class="w-32 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 font-mono text-center focus:outline-none focus:border-sky-500"
							/>
							<button
								type="submit"
								class="px-3 py-2 text-sm font-medium bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded transition-colors"
								onclick={(e) => { if (!confirm('Disable MFA? Your account will be less secure.')) e.preventDefault(); }}
							>
								Disable
							</button>
						</div>
					</form>
				</details>
			</div>

			<!-- Backup codes card -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
				<h2 class="text-sm font-medium text-zinc-300 mb-1">Backup codes</h2>
				<p class="text-zinc-500 text-sm mb-3">
					Generate a fresh set of single-use backup codes. Your old codes will be invalidated.
				</p>

				{#if !showRegenForm}
					<button
						type="button"
						onclick={() => showRegenForm = true}
						class="px-3 py-1.5 text-xs font-medium text-zinc-400 border border-zinc-700 rounded hover:text-zinc-200 hover:border-zinc-600 transition-colors"
					>
						Regenerate backup codes…
					</button>
				{:else}
					<form method="post" action="?/regenBackupCodes" use:enhance class="space-y-2">
						<label for="regen-code" class="block text-xs text-zinc-500">
							Confirm with your current TOTP code
						</label>
						<div class="flex items-center gap-2">
							<input
								id="regen-code"
								name="code"
								type="text"
								inputmode="numeric"
								autocomplete="one-time-code"
								maxlength="6"
								placeholder="000000"
								class="w-32 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 font-mono text-center focus:outline-none focus:border-sky-500"
							/>
							<button
								type="submit"
								class="px-3 py-2 text-sm font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 rounded transition-colors"
							>
								Regenerate
							</button>
							<button
								type="button"
								onclick={() => showRegenForm = false}
								class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
							>
								Cancel
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</div>
