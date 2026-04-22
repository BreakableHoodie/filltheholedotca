import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { decodeHtmlEntities } from '$lib/escape';
import { PUBLIC_COORD_DECIMALS, roundPublicCoord } from '$lib/geo';

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
	parts.push(`Location: ${roundPublicCoord(p.lat).toFixed(PUBLIC_COORD_DECIMALS)}, ${roundPublicCoord(p.lng).toFixed(PUBLIC_COORD_DECIMALS)}`);
	if (p.filled_at) {
		parts.push(`Filled: ${new Date(p.filled_at).toUTCString()}`);
	}

	return parts.join(' ');
}

/** Timestamp used for feed ordering: first-report time for open potholes, fill time for filled ones. */
function eventTime(p: { status: string; created_at: string; filled_at: string | null }): string {
	return p.filled_at ?? p.created_at;
}

export const GET: RequestHandler = async ({ request }) => {
	// Fetch the 50 most-recently-reported (by created_at) and 50 most-recently-filled
	// potholes separately so a fill today isn't buried by older reports. Merge and
	// re-sort by event time (created_at for reported, filled_at for filled).
	const [reportedResult, filledResult] = await Promise.all([
		supabase
			.from('potholes')
			.select('id, created_at, lat, lng, address, description, status, confirmed_count, filled_at')
			.eq('status', 'reported')
			.order('created_at', { ascending: false })
			.limit(50),
		supabase
			.from('potholes')
			.select('id, created_at, lat, lng, address, description, status, confirmed_count, filled_at')
			.eq('status', 'filled')
			.order('filled_at', { ascending: false })
			.limit(50)
	]);

	if (reportedResult.error || filledResult.error) throw error(500, 'Failed to load data');

	// Merge and deduplicate (a pothole could theoretically appear in both if status
	// changed between the two queries — extremely unlikely but safe to guard).
	const seen = new Set<string>();
	const merged = [...(reportedResult.data ?? []), ...(filledResult.data ?? [])].filter((p) => {
		if (seen.has(p.id)) return false;
		seen.add(p.id);
		return true;
	});

	// Sort unified timeline by event time (fill date for filled, creation for reported).
	merged.sort(
		(a, b) => new Date(eventTime(b)).getTime() - new Date(eventTime(a)).getTime()
	);

	const potholes = merged.slice(0, 100);
	// Use epoch when empty so Last-Modified is stable and 304s remain effective.
	const lastBuild = potholes[0] ? new Date(eventTime(potholes[0])).toUTCString() : new Date(0).toUTCString();

	const items = potholes
		.map((p) => {
			const link = `${SITE_URL}/hole/${p.id}`;
			// pubDate reflects when the event occurred — fill date for filled items,
			// confirmation date for reported items.
			const pubDate = new Date(eventTime(p)).toUTCString();
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

	// 304 Not Modified: skip sending the body if the CDN/client has current data.
	// lastBuild is already the most recent event time in this feed.
	const ifModifiedSince = request.headers.get('if-modified-since');
	if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(lastBuild)) {
		return new Response(null, {
			status: 304,
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
				'Last-Modified': lastBuild,
				'Access-Control-Allow-Origin': '*',
				'Cross-Origin-Resource-Policy': 'cross-origin'
			}
		});
	}

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
			'Last-Modified': lastBuild,
			'Access-Control-Allow-Origin': '*',
			'Cross-Origin-Resource-Policy': 'cross-origin'
		}
	});
};
