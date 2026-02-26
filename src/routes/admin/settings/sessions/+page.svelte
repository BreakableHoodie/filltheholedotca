<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { formatDistanceToNow, format } from 'date-fns';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	function parseUA(ua: string | null): string {
		if (!ua) return 'Unknown browser';
		// Very rough UA parsing — sufficient for admin display
		if (ua.includes('Firefox')) return 'Firefox';
		if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
		if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
		if (ua.includes('Edg')) return 'Edge';
		if (ua.includes('curl')) return 'curl';
		return ua.slice(0, 40);
	}
</script>

<svelte:head>
	<title>Active Sessions — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6 max-w-2xl">
	<nav class="flex items-center gap-2 text-sm text-zinc-500 mb-5">
		<span class="text-zinc-300">Settings</span>
		<span>/</span>
		<span class="text-zinc-300">Sessions</span>
	</nav>

	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-xl font-semibold text-zinc-100">Active Sessions</h1>
			<p class="text-zinc-500 text-sm mt-0.5">
				{data.sessions.length} session{data.sessions.length !== 1 ? 's' : ''} for your account
			</p>
		</div>

		{#if data.hasOtherSessions}
			<form method="post" action="?/revokeOthers" use:enhance>
				<button
					type="submit"
					class="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-600/30 rounded hover:bg-red-600/10 transition-colors"
					onclick={(e) => {
						if (!confirm('Revoke all sessions except this one?')) e.preventDefault();
					}}
				>
					Revoke all others
				</button>
			</form>
		{/if}
	</div>

	{#if form?.success}
		<div class="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
			Other sessions revoked.
		</div>
	{/if}

	<div class="bg-zinc-900 border border-zinc-800 rounded-lg divide-y divide-zinc-800">
		{#each data.sessions as session (session.id)}
			<div class="px-4 py-4 flex items-start gap-3">
				<!-- Browser icon -->
				<div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
					<svg class="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
					</svg>
				</div>

				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<p class="text-zinc-200 text-sm font-medium">
							{parseUA(session.user_agent)}
						</p>
						{#if session.isCurrent}
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-sky-400 bg-sky-500/10">
								This session
							</span>
						{/if}
					</div>

					<div class="flex items-center gap-3 mt-0.5 flex-wrap">
						{#if session.ip_address}
							<span class="text-zinc-500 text-xs font-mono">{session.ip_address}</span>
							<span class="text-zinc-700">·</span>
						{/if}
						<span class="text-zinc-500 text-xs">
							Active {formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true })}
						</span>
						<span class="text-zinc-700">·</span>
						<span class="text-zinc-600 text-xs">
							Created {format(new Date(session.created_at), 'PPP')}
						</span>
					</div>
				</div>
			</div>
		{:else}
			<div class="px-4 py-8 text-center text-zinc-600 text-sm">No active sessions.</div>
		{/each}
	</div>
</div>
