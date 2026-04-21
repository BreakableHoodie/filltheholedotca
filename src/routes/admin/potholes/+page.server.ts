import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z } from 'zod';
import type { PotholeStatus } from '$lib/types';
import { requireRole, writeAuditLog } from '$lib/server/admin-auth';
import { hashIp } from '$lib/hash';
import { getAdminClient } from '$lib/server/supabase';
const VALID_STATUSES: PotholeStatus[] = ['pending', 'reported', 'filled', 'expired'];
const VALID_SORT_COLS = ['created_at', 'address', 'status', 'confirmed_count'] as const;
const VALID_PAGE_SIZES = [25, 50, 100] as const;

type SortCol = (typeof VALID_SORT_COLS)[number];

function parsePositiveInt(val: string | null, fallback: number): number {
	const n = parseInt(val ?? '', 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	requireRole(locals.adminUser.role, 'viewer');

	// --- Parse query params ---
	const statusParam = url.searchParams.get('status');
	const filterStatus = VALID_STATUSES.includes(statusParam as PotholeStatus)
		? (statusParam as PotholeStatus)
		: null;

	const search = url.searchParams.get('search')?.trim() || null;

	const photosPublishedParam = url.searchParams.get('photosPublished');
	const filterPhotosPublished =
		photosPublishedParam === 'true' ? true : photosPublishedParam === 'false' ? false : null;

	const dateFrom = url.searchParams.get('dateFrom') || null;
	const dateTo = url.searchParams.get('dateTo') || null;

	const sortParam = url.searchParams.get('sort') as SortCol | null;
	const sort: SortCol = VALID_SORT_COLS.includes(sortParam as SortCol)
		? (sortParam as SortCol)
		: 'created_at';
	const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

	const pageSizeRaw = parsePositiveInt(url.searchParams.get('pageSize'), 25);
	const pageSize = (VALID_PAGE_SIZES.includes(pageSizeRaw as (typeof VALID_PAGE_SIZES)[number])
		? pageSizeRaw
		: 25) as (typeof VALID_PAGE_SIZES)[number];

	const page = parsePositiveInt(url.searchParams.get('page'), 1);
	const from = (page - 1) * pageSize;
	const to = from + pageSize - 1;

	// --- Build query ---
	let query = getAdminClient()
		.from('potholes')
		.select(
			'id, created_at, address, status, confirmed_count, lat, lng, filled_at, expired_at, photos_published, pothole_photos(id)',
			{ count: 'exact' }
		)
		.order(sort, { ascending: dir === 'asc' })
		.range(from, to);

	if (filterStatus) query = query.eq('status', filterStatus);
	if (search) query = query.ilike('address', `%${search}%`);
	if (filterPhotosPublished !== null) query = query.eq('photos_published', filterPhotosPublished);
	if (dateFrom) query = query.gte('created_at', dateFrom);
	if (dateTo) {
		// Include the full dateTo day
		const dateToEnd = new Date(dateTo);
		dateToEnd.setDate(dateToEnd.getDate() + 1);
		query = query.lt('created_at', dateToEnd.toISOString().slice(0, 10));
	}

	const { data, count, error: dbErr } = await query;
	if (dbErr) throw error(500, 'Failed to load potholes');

	return {
		potholes: data ?? [],
		total: count ?? 0,
		page,
		pageSize,
		sort,
		dir,
		filterStatus,
		search,
		filterPhotosPublished,
		dateFrom,
		dateTo,
		adminRole: locals.adminUser.role
	};
};

// ---------------------------------------------------------------------------
// Bulk form actions
// ---------------------------------------------------------------------------

const idsSchema = z.array(z.string().uuid()).min(1);

export const actions: Actions = {
	bulkDelete: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'admin');

		const fd = await request.formData();
		const raw = fd.getAll('ids').map(String);
		const parsed = idsSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { error: 'Invalid IDs' });
		const ids = parsed.data;

		await getAdminClient().from('pothole_confirmations').delete().in('pothole_id', ids);
		const { error: dbErr } = await getAdminClient().from('potholes').delete().in('id', ids);
		if (dbErr) return fail(500, { error: 'Failed to delete potholes' });

		const ipHash = await hashIp(getClientAddress());
		for (const id of ids) {
			await writeAuditLog(locals.adminUser.id, 'pothole.delete', 'pothole', id, null, ipHash);
		}

		return { success: true, action: 'delete', count: ids.length };
	},

	bulkChangeStatus: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'editor');

		const fd = await request.formData();
		const raw = fd.getAll('ids').map(String);
		const parsed = idsSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { error: 'Invalid IDs' });
		const ids = parsed.data;

		const statusRaw = fd.get('status')?.toString() ?? '';
		const statusParsed = z.enum(['pending', 'reported', 'filled', 'expired']).safeParse(statusRaw);
		if (!statusParsed.success) return fail(400, { error: 'Invalid status' });
		const s = statusParsed.data;

		const updates = {
			status: s,
			filled_at: s === 'filled' ? new Date().toISOString() : null,
			expired_at: s === 'expired' ? new Date().toISOString() : null
		};

		const { error: dbErr } = await getAdminClient().from('potholes').update(updates).in('id', ids);
		if (dbErr) return fail(500, { error: 'Failed to update status' });

		const ipHash = await hashIp(getClientAddress());
		for (const id of ids) {
			await writeAuditLog(
				locals.adminUser.id,
				'pothole.status_override',
				'pothole',
				id,
				{ status: s },
				ipHash
			);
		}

		return { success: true, action: 'status', count: ids.length, status: s };
	},

	bulkTogglePhotos: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		requireRole(locals.adminUser.role, 'editor');

		const fd = await request.formData();
		const raw = fd.getAll('ids').map(String);
		const parsed = idsSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { error: 'Invalid IDs' });
		const ids = parsed.data;

		const value = fd.get('photos_published') === 'true';

		const { error: dbErr } = await getAdminClient()
			.from('potholes')
			.update({ photos_published: value })
			.in('id', ids);
		if (dbErr) return fail(500, { error: 'Failed to update photo visibility' });

		const ipHash = await hashIp(getClientAddress());
		for (const id of ids) {
			await writeAuditLog(
				locals.adminUser.id,
				'pothole.photos_published_toggle',
				'pothole',
				id,
				{ photos_published: value },
				ipHash
			);
		}

		return { success: true, action: 'photos', count: ids.length, published: value };
	}
};
