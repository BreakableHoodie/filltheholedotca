// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AdminUser, AdminSession } from '$lib/server/admin-auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			adminUser?: AdminUser;
			adminSession?: AdminSession;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
