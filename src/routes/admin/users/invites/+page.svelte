<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { formatDistanceToNow, format, isPast } from 'date-fns';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Split into active / expired
	const activeInvites = $derived(
		data.invites.filter(
			(i) => i.is_active && !i.used_at && !isPast(new Date(i.expires_at))
		)
	);
	const inactiveInvites = $derived(
		data.invites.filter(
			(i) => !i.is_active || i.used_at || isPast(new Date(i.expires_at))
		)
	);

	function copyInviteUrl(code: string) {
		navigator.clipboard.writeText(`${data.origin}/admin/signup?code=${code}`);
	}

	function roleColor(role: string): string {
		switch (role) {
			case 'admin':
				return 'text-red-400 bg-red-500/10';
			case 'editor':
				return 'text-sky-400 bg-sky-500/10';
			default:
				return 'text-zinc-400 bg-zinc-700/50';
		}
	}
</script>

<svelte:head>
	<title>Invite Codes — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6 max-w-4xl">
	<!-- Breadcrumb -->
	<nav class="flex items-center gap-2 text-sm text-zinc-500 mb-5">
		<a href="/admin/users" class="hover:text-zinc-300 transition-colors">Users</a>
		<span>/</span>
		<span class="text-zinc-300">Invite Codes</span>
	</nav>

	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-xl font-semibold text-zinc-100">Invite Codes</h1>
			<p class="text-zinc-500 text-sm mt-0.5">
				{activeInvites.length} active · {inactiveInvites.length} expired/used
			</p>
		</div>
	</div>

	{#if form?.error}
		<div
			class="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
		>
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div
			class="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm"
		>
			Done.
		</div>
	{/if}

	<!-- Create invite form -->
	<div class="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
		<h2 class="text-sm font-medium text-zinc-300 mb-3">Create Invite</h2>
		<form method="post" action="?/createInvite" use:enhance class="flex items-end gap-3 flex-wrap">
			<div>
				<label for="role" class="block text-xs text-zinc-500 mb-1.5">Role</label>
				<select
					id="role"
					name="role"
					class="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sky-500"
				>
					<option value="editor" selected>editor</option>
					<option value="viewer">viewer</option>
					<option value="admin">admin</option>
				</select>
			</div>
			<div class="flex-1 min-w-48">
				<label for="email" class="block text-xs text-zinc-500 mb-1.5">
					Restrict to email <span class="text-zinc-700">(optional)</span>
				</label>
				<input
					id="email"
					name="email"
					type="email"
					placeholder="someone@example.com"
					class="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500"
				/>
			</div>
			<button
				type="submit"
				class="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
			>
				Generate
			</button>
		</form>
		<p class="text-zinc-600 text-xs mt-2">Codes expire in 7 days and are single-use.</p>
	</div>

	<!-- Active invites -->
	{#if activeInvites.length > 0}
		<div class="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden mb-5">
			<div class="px-4 py-3 border-b border-zinc-800">
				<h2 class="text-sm font-medium text-zinc-300">Active</h2>
			</div>
			<div class="divide-y divide-zinc-800">
				{#each activeInvites as invite (invite.id)}
					<div class="px-4 py-3 flex items-center gap-4 flex-wrap">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<span
									class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize {roleColor(invite.role)}"
								>
									{invite.role}
								</span>
								{#if invite.email}
									<span class="text-zinc-400 text-xs">→ {invite.email}</span>
								{/if}
								<span class="text-zinc-600 text-xs font-mono"
									>{invite.code.slice(0, 8)}…</span
								>
							</div>
							<div class="flex items-center gap-3 mt-1">
								<span class="text-zinc-600 text-xs">
									Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
								</span>
								{#if invite.creator}
									<span class="text-zinc-700 text-xs">·</span>
									<span class="text-zinc-600 text-xs">
										by {invite.creator.first_name}
										{invite.creator.last_name}
									</span>
								{/if}
							</div>
						</div>

						<div class="flex items-center gap-2 flex-shrink-0">
							<button
								type="button"
								onclick={() => copyInviteUrl(invite.code)}
								class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-400 border border-sky-600/30 rounded hover:bg-sky-600/10 transition-colors"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
								Copy link
							</button>
							<form method="post" action="?/deactivateInvite" use:enhance>
								<input type="hidden" name="id" value={invite.id} />
								<button
									type="submit"
									class="px-3 py-1.5 text-xs text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-900/40 rounded transition-colors"
								>
									Revoke
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Expired / used invites -->
	{#if inactiveInvites.length > 0}
		<div class="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
			<div class="px-4 py-3 border-b border-zinc-800">
				<h2 class="text-sm font-medium text-zinc-500">Expired / Used</h2>
			</div>
			<div class="divide-y divide-zinc-800">
				{#each inactiveInvites as invite (invite.id)}
					<div class="px-4 py-3 flex items-center gap-4 opacity-60">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<span
									class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize {roleColor(invite.role)}"
								>
									{invite.role}
								</span>
								{#if invite.email}
									<span class="text-zinc-400 text-xs">→ {invite.email}</span>
								{/if}
							</div>
							<div class="flex items-center gap-3 mt-1">
								{#if invite.used_at && invite.used_by_user}
									<span class="text-zinc-600 text-xs">
										Used by {invite.used_by_user.first_name}
										{invite.used_by_user.last_name}
										{formatDistanceToNow(new Date(invite.used_at), { addSuffix: true })}
									</span>
								{:else if invite.used_at}
									<span class="text-zinc-600 text-xs">
										Used {formatDistanceToNow(new Date(invite.used_at), { addSuffix: true })}
									</span>
								{:else}
									<span class="text-zinc-600 text-xs">
										Expired {format(new Date(invite.expires_at), 'PPP')}
									</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
