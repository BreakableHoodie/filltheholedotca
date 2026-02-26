// @ts-check
import svelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import tsEslint from "typescript-eslint";

/**
 * General ESLint flat config for the project.
 * Run via: npm run lint
 *
 * Note: Svelte a11y checking is handled by the Svelte compiler via
 * `npm run lint:a11y` (svelte-check --threshold warning), not ESLint,
 * because eslint-plugin-svelte v3 removed a11y rules in favour of
 * compiler-level accessibility diagnostics.
 */
export default tsEslint.config(
  {
    ignores: [
      ".svelte-kit/**",
      "build/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      ".worktrees/**",
      ".vercel/**",
      ".netlify/**",
    ],
  },
  // TypeScript files
  ...tsEslint.configs.recommended,
  // Svelte files (flat/recommended already includes svelte-eslint-parser)
  ...svelte.configs["flat/recommended"],
  // Override: use @typescript-eslint/parser as svelte's TypeScript sub-parser
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsEslint.parser,
      },
    },
  },
  // Disable view-transition rule — this app does not use Svelte view transitions
  // (svelte/no-navigation-without-resolve requires resolve() from $app/navigation
  // only when using the onNavigate() view transition API)
  {
    rules: {
      "svelte/no-navigation-without-resolve": "off",
    },
  },
);
