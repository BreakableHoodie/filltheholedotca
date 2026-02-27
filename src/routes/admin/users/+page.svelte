<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

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
	<title>Users — fillthehole.ca Admin</title>
</svelte:head>

<div class="p-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-xl font-semibold text-zinc-100">Users</h1>
			<p class="text-zinc-500 text-sm mt-0.5">
				{data.users.length} admin account{data.users.length !== 1 ? 's' : ''}
			</p>
		</div>
		<a
			href="/admin/users/invites"
			class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sky-400 border border-sky-600/30 rounded hover:bg-sky-600/10 transition-colors"
		>
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
			Manage Invites
		</a>
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
			Saved.
		</div>
	{/if}

	<div class="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-zinc-800 text-left">
					<th class="px-4 py-3 text-zinc-500 font-medium">User</th>
					<th class="px-4 py-3 text-zinc-500 font-medium">Role</th>
					<th class="px-4 py-3 text-zinc-500 font-medium">Status</th>
					<th class="px-4 py-3 text-zinc-500 font-medium">MFA</th>
					<th class="px-4 py-3 text-zinc-500 font-medium">Sessions</th>
					<th class="px-4 py-3 text-zinc-500 font-medium">Last login</th>
					<th class="px-4 py-3 text-zinc-500 font-medium">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-zinc-800">
				{#each data.users as user (user.id)}
					{@const isSelf = user.id === data.currentUserId}
					<tr class="hover:bg-zinc-800/30 transition-colors">
						<!-- Name + email -->
						<td class="px-4 py-3">
							<p class="text-zinc-200 font-medium">
								{user.first_name}
								{user.last_name}
								{#if isSelf}
									<span class="text-xs text-zinc-500 font-normal">(you)</span>
								{/if}
							</p>
							<p class="text-zinc-500 text-xs mt-0.5">{user.email}</p>
						</td>

						<!-- Role (with change form) -->
						<td class="px-4 py-3">
							{#if isSelf}
								<span
									class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize {roleColor(user.role)}"
								>
									{user.role}
								</span>
							{:else}
								<form
									method="post"
									action="?/changeRole"
									use:enhance
									class="flex items-center gap-1.5"
								>
									<input type="hidden" name="userId" value={user.id} />
									<select
										name="role"
										class="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
									>
										{#each ['admin', 'editor', 'viewer'] as r (r)}
											<option value={r} selected={user.role === r}>{r}</option>
										{/each}
									</select>
									<button
										type="submit"
										class="text-xs text-zinc-400 hover:text-zinc-100 transition-colors px-1 py-0.5"
										title="Save role"
									>
										Save
									</button>
								</form>
							{/if}
						</td>

						<!-- Status -->
						<td class="px-4 py-3">
							{#if user.is_active}
								<span
									class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-emerald-400 bg-emerald-500/10"
									>Active</span
								>
							{:else if user.activated_at}
								<span
									class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-amber-400 bg-amber-500/10"
									>Deactivated</span
								>
							{:else}
								<span
									class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-zinc-400 bg-zinc-700/50"
									>Pending</span
								>
							{/if}
						</td>

						<!-- MFA -->
						<td class="px-4 py-3">
							{#if user.totp_enabled}
								<span class="text-emerald-400 text-xs">Enabled</span>
							{:else}
								<span class="text-zinc-600 text-xs">—</span>
							{/if}
						</td>

						<!-- Active sessions -->
						<td class="px-4 py-3 text-zinc-400 tabular-nums text-xs">
							{user.activeSessions}
						</td>

						<!-- Last login -->
						<td class="px-4 py-3 text-zinc-500 text-xs">
							{#if user.last_login_at}
								{formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true })}
							{:else}
								Never
							{/if}
						</td>

						<!-- Actions -->
						<td class="px-4 py-3">
							{#if !isSelf}
								<div class="flex items-center gap-2">
									<!-- Activate / Deactivate -->
									{#if user.is_active}
										<form method="post" action="?/deactivate" use:enhance>
											<input type="hidden" name="userId" value={user.id} />
											<button
												type="submit"
												class="text-xs text-amber-400 hover:text-amber-300 transition-colors"
												onclick={(e) => {
													if (!confirm('Deactivate this user and revoke all their sessions?'))
														e.preventDefault();
												}}
											>
												Deactivate
											</button>
										</form>
									{:else}
										<form method="post" action="?/activate" use:enhance>
											<input type="hidden" name="userId" value={user.id} />
											<button
												type="submit"
												class="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
											>
												Activate
											</button>
										</form>
									{/if}

									<!-- Revoke sessions -->
									{#if user.activeSessions > 0}
										<span class="text-zinc-700">·</span>
										<form method="post" action="?/revokeAll" use:enhance>
											<input type="hidden" name="userId" value={user.id} />
											<button
												type="submit"
												class="text-xs text-zinc-500 hover:text-red-400 transition-colors"
												onclick={(e) => {
													if (!confirm('Revoke all sessions for this user?')) e.preventDefault();
												}}
											>
												Revoke sessions
											</button>
										</form>
									{/if}
								</div>
							{:else}
								<span class="text-zinc-700 text-xs">—</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
