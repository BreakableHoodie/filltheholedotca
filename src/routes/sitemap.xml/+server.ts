import { supabase } from '$lib/supabase';
import type { RequestHandler } from './$types';

const ORIGIN = 'https://fillthehole.ca';

const STATIC_PAGES = [
	{ path: '/', changefreq: 'daily', priority: '1.0' },
	{ path: '/stats', changefreq: 'daily', priority: '0.8' },
	{ path: '/how-to', changefreq: 'monthly', priority: '0.6' },
	{ path: '/about', changefreq: 'monthly', priority: '0.5' }
];

export const GET: RequestHandler = async () => {
	const { data: potholes } = await supabase
		.from('potholes')
		.select('id, created_at, filled_at, status')
		.in('status', ['reported', 'filled'])
		.order('created_at', { ascending: false });

	const staticEntries = STATIC_PAGES.map(
		({ path, changefreq, priority }) => `
  <url>
    <loc>${ORIGIN}${path}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
	).join('');

	const potholeEntries = (potholes ?? [])
		.map(({ id, created_at, filled_at, status }) => {
			const lastmod = (filled_at ?? created_at).slice(0, 10);
			const priority = status === 'filled' ? '0.5' : '0.7';
			return `
  <url>
    <loc>${ORIGIN}/hole/${id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
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
