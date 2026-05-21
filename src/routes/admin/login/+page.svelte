<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Sign in — fillthehole.ca Admin</title>
</svelte:head>

<div class="min-h-screen bg-stone-950 flex items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="text-center mb-8">
			<p class="text-amber-400 font-bold text-xl">fillthehole.ca</p>
			<p class="text-stone-500 text-sm mt-1">Admin Panel</p>
		</div>

		<div class="bg-stone-900 border border-stone-800 rounded-lg p-6">
			<h1 class="text-lg font-semibold text-stone-100 mb-5">Sign in</h1>

			{#if form?.error}
				<div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
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
			>
				<input type="hidden" name="next" value={data.next} />

				<div class="space-y-4">
					<div>
						<label for="email" class="block text-xs font-medium text-stone-400 mb-1.5">Email</label>
						<input
							id="email"
							type="email"
							name="email"
							value={form?.email ?? ''}
							required
							autocomplete="email"
							class="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors"
							placeholder="you@example.com"
						/>
					</div>

					<div>
						<label for="password" class="block text-xs font-medium text-stone-400 mb-1.5"
							>Password</label
						>
						<input
							id="password"
							type="password"
							name="password"
							required
							autocomplete="current-password"
							class="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors"
							placeholder="••••••••"
						/>
					</div>
				</div>

				<button
					type="submit"
					disabled={submitting}
					class="mt-5 w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
				>
					{submitting ? 'Signing in…' : 'Sign in'}
				</button>
			</form>

			<p class="mt-5 text-center text-xs text-stone-600">
				Forgot your password? Contact an administrator.
			</p>
		</div>
	</div>
</div>
