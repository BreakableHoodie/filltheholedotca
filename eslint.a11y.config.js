// @ts-check
/**
 * eslint-plugin-svelte v3 removed a11y rules in favour of the Svelte compiler's
 * built-in accessibility diagnostics.
 *
 * A11y linting is handled by:
 *   npm run lint:a11y  →  svelte-check --threshold warning
 *
 * This file is kept for reference. General ESLint config lives in eslint.config.js.
 */
export { default } from './eslint.config.js';
