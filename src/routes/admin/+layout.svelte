<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';

	interface Props {
		data: LayoutData;
		children: Snippet;
	}

	let { data, children }: Props = $props();

	const user = $derived(data.adminUser);
	const currentPath = $derived($page.url.pathname);

	function isActive(path: string): boolean {
		return currentPath.startsWith(path);
	}
</script>

{#if user}
	<div class="flex min-h-screen bg-zinc-950 text-zinc-100">
		<!-- Sidebar -->
		<aside class="w-52 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
			<!-- Brand -->
			<div class="px-4 py-4 border-b border-zinc-800">
				<a href="/admin" class="block">
					<span class="text-sky-400 font-bold text-sm">fillthehole.ca</span>
					<span class="block text-zinc-500 text-xs mt-0.5">Admin Panel</span>
				</a>
			</div>

			<!-- Nav -->
			<nav class="flex-1 px-2 py-3 space-y-0.5">
				<a
					href="/admin"
					class="flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors {currentPath === '/admin' ? 'bg-sky-600/20 text-sky-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
				>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
					</svg>
					Dashboard
				</a>

				<a
					href="/admin/photos"
					class="flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors {isActive('/admin/photos') ? 'bg-sky-600/20 text-sky-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
				>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					Photos
				</a>

				<a
					href="/admin/potholes"
					class="flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors {isActive('/admin/potholes') ? 'bg-sky-600/20 text-sky-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
				>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					Potholes
				</a>

				{#if user.role === 'admin'}
					<a
						href="/admin/users"
						class="flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors {isActive('/admin/users') ? 'bg-sky-600/20 text-sky-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
					>
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
						Users
					</a>
				{/if}

				<a
					href="/admin/audit"
					class="flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors {isActive('/admin/audit') ? 'bg-sky-600/20 text-sky-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
				>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
					</svg>
					Audit Log
				</a>

				<div class="pt-2 mt-1 border-t border-zinc-800 space-y-0.5">
					<a
						href="/admin/settings/password"
						class="flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors {isActive('/admin/settings/password') ? 'bg-sky-600/20 text-sky-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
					>
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
						</svg>
						Change Password
					</a>
					<a
						href="/admin/settings/mfa"
						class="flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors {isActive('/admin/settings/mfa') ? 'bg-sky-600/20 text-sky-400' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
					>
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						Two-Factor Auth
					</a>
				</div>
			</nav>

			<!-- User + Logout -->
			<div class="px-2 py-3 border-t border-zinc-800">
				<div class="flex items-center gap-2.5 px-2 mb-2">
					<div class="w-7 h-7 rounded-full bg-sky-700 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
						{user.firstName[0]}{user.lastName[0]}
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-xs font-medium truncate text-zinc-200">{user.firstName} {user.lastName}</p>
						<p class="text-zinc-500 text-xs capitalize">{user.role}</p>
					</div>
				</div>
				<form method="post" action="/admin/logout">
					<button
						type="submit"
						class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
						Sign out
					</button>
				</form>
			</div>
		</aside>

		<!-- Main -->
		<main class="flex-1 overflow-auto">
			{@render children()}
		</main>
	</div>
{:else}
	<!-- Login pages — no sidebar -->
	{@render children()}
{/if}
