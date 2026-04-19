import { getConfirmationThreshold } from "$lib/server/settings";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
    return { confirmationThreshold: 2 };
  }
  return {
    confirmationThreshold: await getConfirmationThreshold(),
  };
};
