import { getConfirmationThreshold } from "$lib/server/settings";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  return {
    confirmationThreshold: await getConfirmationThreshold(),
  };
};
