import { getConfirmationThreshold } from '$lib/server/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
		return { confirmationThreshold: 2 };
	}
	setHeaders({ 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' });
	return {
		confirmationThreshold: await getConfirmationThreshold(),
	};
};
