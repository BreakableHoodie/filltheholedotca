import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from './$types';

const ORIGIN = 'https://fillthehole.ca';

const STATIC_PAGES = [
	{ path: '/', changefreq: 'daily', priority: '1.0' },
	{ path: '/stats', changefreq: 'daily', priority: '0.8' },
	{ path: '/how-to', changefreq: 'monthly', priority: '0.6' },
	{ path: '/about', changefreq: 'monthly', priority: '0.5' }
];

const PRIORITY: Record<string, string> = {
	reported: '0.7',
	filled: '0.5',
	expired: '0.3'
};

export const GET: RequestHandler = async () => {
	const { data: potholes, error: dbError } = await supabase
		.from('potholes')
		.select('id, created_at, filled_at, status')
		.in('status', ['reported', 'filled', 'expired'])
		.order('created_at', { ascending: false });

	if (dbError) {
		console.error('sitemap: supabase error', dbError.message);
		error(503, 'Sitemap temporarily unavailable');
	}

	const staticEntries = STATIC_PAGES.map(
		({ path, changefreq, priority }) => `
  <url>
    <loc>${ORIGIN}${path}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
	).join('');

	const potholeEntries = potholes
		.map(({ id, created_at, filled_at, status }) => {
			const lastmod = (filled_at ?? created_at).slice(0, 10);
			const priority = PRIORITY[status] ?? '0.3';
			const changefreq = status === 'reported' ? 'weekly' : 'monthly';
			return `
  <url>
    <loc>${ORIGIN}/hole/${id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
		})
		.join('');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${potholeEntries}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
