import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'list',

	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry',
		// Accessibility tests benefit from consistent viewport
		viewport: { width: 1280, height: 720 }
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],

	// Start the dev server automatically for local runs
	webServer: {
		command: 'npm run build && npm run preview',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			// Playwright needs real-ish env vars to build; use placeholders if not set
			PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
			PUBLIC_SUPABASE_ANON_KEY: process.env.PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder_anon_key',
			SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder_service_role_key',
			ADMIN_SECRET: process.env.ADMIN_SECRET ?? 'placeholder_admin_secret'
		}
	}
});
