import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { decodeHtmlEntities } from '$lib/escape';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

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

function toRow(p: Row): string {
	return COLUMNS.map((col) => {
		const val = p[col];
		// Decode any legacy HTML entities in text fields before exporting.
		if ((col === 'address' || col === 'description') && typeof val === 'string') {
			return csvField(decodeHtmlEntities(val));
		}
		return csvField(val);
	}).join(',');
}

export const GET: RequestHandler = async () => {
	// Export all publicly visible potholes — pending suppressed (not confirmed).
	// The anon key SELECT policy on `potholes` already excludes no rows beyond RLS,
	// so we filter status explicitly to match the public intent.
	const { data, error: dbError } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, address, description, status, confirmed_count, filled_at, expired_at')
		.in('status', ['reported', 'filled', 'expired'])
		.order('created_at', { ascending: false });

	if (dbError) throw error(500, 'Failed to load data');

	const header = COLUMNS.join(',');
	const rows = (data ?? []).map((p) => toRow(p as Row));
	const csv = [header, ...rows].join('\r\n');

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="fillthehole-potholes.csv"',
			'Cache-Control': 'public, max-age=300',
			'Access-Control-Allow-Origin': '*',
			'Cross-Origin-Resource-Policy': 'cross-origin'
		}
	});
};
