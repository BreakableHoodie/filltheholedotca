import adapter from '@sveltejs/adapter-netlify';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		// H2: Nonce-based CSP removes the need for 'unsafe-inline' in script-src.
		// SvelteKit generates a fresh nonce per request, injects it into all inline
		// <script> tags it controls, and appends nonce-{value} to the script-src header.
		// M5: Added object-src, base-uri, form-action, worker-src to plug CSP gaps.
		csp: {
			mode: 'nonce',
			directives: {
				'default-src': ["'self'"],
				'script-src': ["'self'"], // nonce-{nonce} appended automatically
				'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
				'img-src': [
					"'self'",
					'data:',
					'blob:',
					'https://*.supabase.co',
					'https://*.tile.openstreetmap.org'
				],
				'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
				'connect-src': [
					"'self'",
					'https://*.supabase.co',
					'https://nominatim.openstreetmap.org'
				],
				'frame-ancestors': ["'none'"],
				'object-src': ["'none'"],
				'base-uri': ["'none'"],
				'form-action': ["'self'"],
				'worker-src': ["'none'"]
			}
		}
	}
};

export default config;
