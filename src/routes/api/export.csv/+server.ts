import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { decodeHtmlEntities } from '$lib/escape';
import { roundPublicCoord } from '$lib/geo';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

// Hard cap — prevents unbounded memory/response growth as the table scales.
// Revisit if/when the dataset approaches this ceiling.
const ROW_LIMIT = 10_000;

const COLUMNS = [
	'id',
	'created_at',
	'lat',
	'lng',
	'address',
	'description',
	'status',
	'confirmed_count',
	'filled_at',
	'expired_at'
] as const;

type Row = Record<(typeof COLUMNS)[number], string | number | null>;

/**
 * RFC 4180 CSV field quoting.
 * Wrap in double-quotes and escape any embedded double-quotes by doubling them.
 */
function csvField(value: string | number | null): string {
	if (value === null || value === undefined) return '';
	const str = String(value);
	if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
		return '"' + str.replace(/"/g, '""') + '"';
	}
	return str;
}

/**
 * Neutralize spreadsheet formula injection.
 * Excel and Google Sheets evaluate cells beginning with =, +, -, @ as formulas
 * even inside a quoted CSV field. Prefix with a tab so the value is treated as
 * plain text. The tab is invisible in most spreadsheet apps.
 */
function neutralizeFormula(str: string): string {
	if (/^[=+\-@]/.test(str)) return '\t' + str;
	return str;
}

function toRow(p: Row): string {
	return COLUMNS.map((col) => {
		const val = p[col];
		if ((col === 'address' || col === 'description') && typeof val === 'string') {
			return csvField(neutralizeFormula(decodeHtmlEntities(val)));
		}
		if ((col === 'lat' || col === 'lng') && typeof val === 'number') {
			// Round any historical rows stored at full precision before the write-time fix landed.
			return csvField(roundPublicCoord(val));
		}
		return csvField(val);
	}).join(',');
}

export const GET: RequestHandler = async ({ request }) => {
	// Export all publicly visible potholes — pending suppressed (not confirmed).
	// The anon key SELECT policy on `potholes` already excludes no rows beyond RLS,
	// so we filter status explicitly to match the public intent.
	const { data, error: dbError } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, address, description, status, confirmed_count, filled_at, expired_at')
		.in('status', ['reported', 'filled', 'expired'])
		.order('created_at', { ascending: false })
		.limit(ROW_LIMIT);

	if (dbError) throw error(500, 'Failed to load data');

	const rows = data ?? [];

	// Compute Last-Modified from the most recent event in this export.
	const lastModifiedMs = rows.reduce((max, p) => {
		const t = Math.max(
			new Date(p.created_at).getTime(),
			p.filled_at ? new Date(p.filled_at).getTime() : 0,
			p.expired_at ? new Date(p.expired_at).getTime() : 0
		);
		return t > max ? t : max;
	}, 0);
	// Use epoch (not Date.now()) when empty so the value is stable across requests.
	const lastModified = new Date(lastModifiedMs).toUTCString();

	// 304 Not Modified: skip sending the body if the CDN/client has current data.
	const ifModifiedSince = request.headers.get('if-modified-since');
	if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(lastModified)) {
		return new Response(null, {
			status: 304,
			headers: {
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
				'Last-Modified': lastModified,
				'Access-Control-Allow-Origin': '*',
				'Cross-Origin-Resource-Policy': 'cross-origin'
			}
		});
	}

	const header = COLUMNS.join(',');
	const csv = [header, ...rows.map((p) => toRow(p as Row))].join('\r\n');

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="fillthehole-potholes.csv"',
			'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
			'Last-Modified': lastModified,
			'Access-Control-Allow-Origin': '*',
			'Cross-Origin-Resource-Policy': 'cross-origin',
			'X-Row-Limit': String(ROW_LIMIT),
			'X-Row-Count': String(rows.length)
		}
	});
};
