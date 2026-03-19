import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';

const httpsConfig = process.env.HTTPS_KEY && process.env.HTTPS_CERT
	? { key: fs.readFileSync(process.env.HTTPS_KEY), cert: fs.readFileSync(process.env.HTTPS_CERT) }
	: undefined;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		// Preserve Vite 7 production browser floor so users on Safari 16.0–16.3 or
		// Firefox 104–113 are not silently broken by Vite 8's raised default targets.
		target: ['chrome107', 'firefox104', 'safari16']
	},
	server: {
		https: httpsConfig,
		host: true,
		allowedHosts: true // allow any hostname — required for Cloudflare Tunnel, ngrok, etc.
	}
});
