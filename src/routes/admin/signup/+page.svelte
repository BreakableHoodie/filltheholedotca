<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let submitting = $state(false);
	const createdRole = $derived(form?.role ?? data.invite?.role ?? (data.bootstrap ? 'admin' : 'editor'));
</script>

<svelte:head>
	<title>Create Account — fillthehole.ca Admin</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
	<div class="w-full max-w-md">
		<div class="mb-8 text-center">
			<span class="text-sky-400 font-bold text-lg">fillthehole.ca</span>
			<p class="text-zinc-500 text-sm mt-1">Admin Panel</p>
		</div>

		{#if form?.registered}
			<!-- Success state -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
				<div class="text-4xl mb-4">✅</div>
				<h1 class="text-xl font-semibold text-zinc-100 mb-2">Account Created</h1>
				<p class="text-zinc-400 text-sm leading-relaxed">
					Your account has been created with the
					<strong class="text-zinc-300 capitalize">{createdRole}</strong>
					role.
					{#if form.requiresActivation}
						An administrator must activate it before you can log in.
					{:else}
						It is active now and ready to sign in.
					{/if}
				</p>
				<a
					href="/admin/login"
					class="inline-block mt-6 text-sm text-sky-400 hover:text-sky-300 transition-colors"
				>
					Go to login →
				</a>
			</div>
		{:else if data.bootstrap}
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
				<h1 class="text-xl font-semibold text-zinc-100 mb-1">Create first admin account</h1>
				<p class="text-zinc-500 text-sm mb-6">
					Bootstrap mode is only available while no admin users exist.
				</p>

				{#if form?.error}
					<div
						class="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
					>
						{form.error}
					</div>
				{/if}

				{#if !data.bootstrapConfigured}
					<div class="px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
						Bootstrap is disabled. Set <code class="text-amber-200">ADMIN_BOOTSTRAP_SECRET</code>
						in your environment to a long random value, then reload this page.
					</div>
				{:else}
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
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="firstName" class="block text-xs text-zinc-500 mb-1.5">First name</label>
								<input
									id="firstName"
									name="firstName"
									type="text"
									autocomplete="given-name"
									value={form?.firstName ?? ''}
									required
									class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
								/>
							</div>
							<div>
								<label for="lastName" class="block text-xs text-zinc-500 mb-1.5">Last name</label>
								<input
									id="lastName"
									name="lastName"
									type="text"
									autocomplete="family-name"
									value={form?.lastName ?? ''}
									required
									class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
								/>
							</div>
						</div>

						<div>
							<label for="email" class="block text-xs text-zinc-500 mb-1.5">Email</label>
							<input
								id="email"
								name="email"
								type="email"
								autocomplete="email"
								value={form?.email ?? ''}
								required
								class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
							/>
						</div>

						<div>
							<label for="password" class="block text-xs text-zinc-500 mb-1.5">Password</label>
							<input
								id="password"
								name="password"
								type="password"
								autocomplete="new-password"
								required
								minlength="12"
								class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
							/>
							<p class="text-zinc-600 text-xs mt-1">
								At least 12 chars with uppercase, lowercase, number, and symbol.
							</p>
						</div>

						<div>
							<label for="confirmPassword" class="block text-xs text-zinc-500 mb-1.5"
								>Confirm password</label
							>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								autocomplete="new-password"
								required
								class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
							/>
						</div>

						<div>
							<label for="bootstrapSecret" class="block text-xs text-zinc-500 mb-1.5"
								>Bootstrap secret</label
							>
							<input
								id="bootstrapSecret"
								name="bootstrapSecret"
								type="password"
								autocomplete="off"
								required
								class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
							/>
						</div>

						<button
							type="submit"
							disabled={submitting}
							class="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors"
						>
							{submitting ? 'Creating admin account…' : 'Create first admin account'}
						</button>
					</form>
				{/if}
			</div>
		{:else if data.invite}
			<!-- Signup form -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
				<h1 class="text-xl font-semibold text-zinc-100 mb-1">Create your account</h1>
				<p class="text-zinc-500 text-sm mb-6">
					You've been invited as a
					<span class="text-zinc-300 font-medium capitalize">{data.invite.role}</span>.
				</p>

				{#if form?.error}
					<div
						class="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
					>
						{form.error}
					</div>
				{/if}

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
					<!-- Hidden invite code — re-validated server-side -->
					<input type="hidden" name="code" value={data.invite.code} />

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="firstName" class="block text-xs text-zinc-500 mb-1.5">First name</label>
							<input
								id="firstName"
								name="firstName"
								type="text"
								autocomplete="given-name"
								value={form?.firstName ?? ''}
								required
								class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
							/>
						</div>
						<div>
							<label for="lastName" class="block text-xs text-zinc-500 mb-1.5">Last name</label>
							<input
								id="lastName"
								name="lastName"
								type="text"
								autocomplete="family-name"
								value={form?.lastName ?? ''}
								required
								class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
							/>
						</div>
					</div>

					<div>
						<label for="email" class="block text-xs text-zinc-500 mb-1.5">Email</label>
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							value={form?.email ?? data.invite.email ?? ''}
							readonly={!!data.invite.email}
							required
							class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20
							       {data.invite.email ? 'opacity-60 cursor-not-allowed' : ''}"
						/>
						{#if data.invite.email}
							<p class="text-zinc-600 text-xs mt-1">Email locked to this invite.</p>
						{/if}
					</div>

					<div>
						<label for="password" class="block text-xs text-zinc-500 mb-1.5">Password</label>
						<input
							id="password"
							name="password"
							type="password"
							autocomplete="new-password"
							required
							minlength="12"
							class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
						/>
						<p class="text-zinc-600 text-xs mt-1">
							At least 12 chars with uppercase, lowercase, number, and symbol.
						</p>
					</div>

					<div>
						<label for="confirmPassword" class="block text-xs text-zinc-500 mb-1.5"
							>Confirm password</label
						>
						<input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							autocomplete="new-password"
							required
							class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
						/>
					</div>

					<button
						type="submit"
						disabled={submitting}
						class="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors"
					>
						{submitting ? 'Creating account…' : 'Create account'}
					</button>
				</form>
			</div>
		{:else}
			<!-- Invalid invite -->
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
				<div class="text-4xl mb-4">⛔</div>
				<h1 class="text-xl font-semibold text-zinc-100 mb-2">Invalid Invite</h1>
				<p class="text-zinc-400 text-sm">
					{data.error ?? 'This invite link is not valid.'}
				</p>
				<p class="text-zinc-600 text-xs mt-3">
					Ask an administrator to generate a new invite link.
				</p>
			</div>
		{/if}
	</div>
</div>
