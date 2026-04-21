import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/admin-auth';
import type { PotholeStatus } from '$lib/types';
import { getAdminClient } from '$lib/server/supabase';
const VALID_STATUSES: PotholeStatus[] = ['pending', 'reported', 'filled', 'expired'];

function escapeCSV(val: unknown): string {
	if (val === null || val === undefined) return '';
	let s = String(val);
	// Neutralize CSV formula injection (OWASP: values starting with =, +, -, @, tab, CR
	// are interpreted as formulas by spreadsheet apps when opened by admins).
	if (s.length > 0 && '=+-@\t\r'.includes(s[0])) {
		s = "'" + s;
	}
	if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes("'")) {
		return '"' + s.replace(/"/g, '""') + '"';
	}
	return s;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'viewer');

	const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';

	// Specific IDs take priority over filters
	const idsParam = url.searchParams.getAll('ids');
	const specificIds = idsParam.filter((id) =>
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
	);

	let query = getAdminClient()
		.from('potholes')
		.select(
			'id, created_at, address, status, confirmed_count, lat, lng, filled_at, expired_at, photos_published'
		)
		.order('created_at', { ascending: false })
		.limit(10_000);

	if (specificIds.length > 0) {
		query = query.in('id', specificIds);
	} else {
		const statusParam = url.searchParams.get('status');
		const filterStatus = VALID_STATUSES.includes(statusParam as PotholeStatus)
			? (statusParam as PotholeStatus)
			: null;
		const search = url.searchParams.get('search')?.trim() || null;
		const photosPublishedParam = url.searchParams.get('photosPublished');
		const filterPhotosPublished =
			photosPublishedParam === 'true'
				? true
				: photosPublishedParam === 'false'
					? false
					: null;
		// M4: Validate date params as strict YYYY-MM-DD before use.
		// Without this, new Date(dateTo) throws a RangeError on garbage input.
		const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
		const rawDateFrom = url.searchParams.get('dateFrom') || null;
		const rawDateTo = url.searchParams.get('dateTo') || null;
		const dateFrom = rawDateFrom && ISO_DATE_RE.test(rawDateFrom) ? rawDateFrom : null;
		const dateTo = rawDateTo && ISO_DATE_RE.test(rawDateTo) ? rawDateTo : null;

		if (filterStatus) query = query.eq('status', filterStatus);
		if (search) query = query.ilike('address', `%${search}%`);
		if (filterPhotosPublished !== null) query = query.eq('photos_published', filterPhotosPublished);
		if (dateFrom) query = query.gte('created_at', dateFrom);
		if (dateTo) {
			const dateToEnd = new Date(dateTo);
			dateToEnd.setDate(dateToEnd.getDate() + 1);
			query = query.lt('created_at', dateToEnd.toISOString().slice(0, 10));
		}
	}

	const { data, error: dbErr } = await query;
	if (dbErr) throw error(500, 'Failed to load potholes');

	const rows = data ?? [];
	const filename = `potholes-${new Date().toISOString().slice(0, 10)}`;

	if (format === 'json') {
		return new Response(JSON.stringify(rows, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${filename}.json"`
			}
		});
	}

	// CSV
	const headers = [
		'id',
		'address',
		'status',
		'confirmed_count',
		'lat',
		'lng',
		'photos_published',
		'created_at',
		'filled_at',
		'expired_at'
	];

	const lines = [
		headers.join(','),
		...rows.map((r) =>
			headers.map((h) => escapeCSV(r[h as keyof typeof r])).join(',')
		)
	];

	return new Response(lines.join('\n'), {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': `attachment; filename="${filename}.csv"`
		}
	});
};
