import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		adminUser: locals.adminUser ?? null
	};
};
