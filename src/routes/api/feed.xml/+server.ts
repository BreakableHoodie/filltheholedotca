import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { decodeHtmlEntities } from '$lib/escape';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

const SITE_URL = 'https://fillthehole.ca';
const FEED_TITLE = 'fillthehole.ca — Waterloo Region Potholes';
const FEED_DESCRIPTION =
	'Community-reported potholes in Kitchener, Waterloo, and Cambridge, Ontario.';

/** Escape the five XML metacharacters for safe embedding in element content. */
function xmlEscape(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function buildTitle(p: {
	status: string;
	address: string | null;
	description: string | null;
}): string {
	const location = p.address ? decodeHtmlEntities(p.address) : `unknown location`;
	if (p.status === 'filled') return `Filled: ${location}`;
	return `Pothole confirmed: ${location}`;
}

function buildDescription(p: {
	status: string;
	lat: number;
	lng: number;
	address: string | null;
	description: string | null;
	confirmed_count: number;
	filled_at: string | null;
}): string {
	const parts: string[] = [];

	if (p.description) {
		parts.push(`Severity: ${decodeHtmlEntities(p.description)}`);
	}
	parts.push(`Confirmed by ${p.confirmed_count} independent report${p.confirmed_count === 1 ? '' : 's'}.`);
	parts.push(`Location: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`);
	if (p.filled_at) {
		parts.push(`Filled: ${new Date(p.filled_at).toUTCString()}`);
	}

	return parts.join(' ');
}

export const GET: RequestHandler = async () => {
	// Newest 100 confirmed or filled potholes — pending excluded (not yet verified).
	const { data, error: dbError } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, address, description, status, confirmed_count, filled_at')
		.in('status', ['reported', 'filled'])
		.order('created_at', { ascending: false })
		.limit(100);

	if (dbError) throw error(500, 'Failed to load data');

	const potholes = data ?? [];
	const now = new Date().toUTCString();
	const lastBuild = potholes[0] ? new Date(potholes[0].created_at).toUTCString() : now;

	const items = potholes
		.map((p) => {
			const link = `${SITE_URL}/hole/${p.id}`;
			const pubDate = new Date(p.created_at).toUTCString();
			const title = xmlEscape(buildTitle(p));
			const description = xmlEscape(buildDescription(p));
			return `  <item>
    <title>${title}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${description}</description>
  </item>`;
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(FEED_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${xmlEscape(FEED_DESCRIPTION)}</description>
    <language>en-ca</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE_URL}/api/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=300',
			'Access-Control-Allow-Origin': '*',
			'Cross-Origin-Resource-Policy': 'cross-origin'
		}
	});
};
