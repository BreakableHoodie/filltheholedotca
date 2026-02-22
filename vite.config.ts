import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';

const httpsConfig = process.env.HTTPS_KEY && process.env.HTTPS_CERT
	? { key: fs.readFileSync(process.env.HTTPS_KEY), cert: fs.readFileSync(process.env.HTTPS_CERT) }
	: undefined;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		https: httpsConfig,
		host: true,
		allowedHosts: true // allow any hostname — required for Cloudflare Tunnel, ngrok, etc.
	}
});
