import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { supabase } from '$lib/supabase';
import { logError } from '$lib/server/observability';
import { roundPublicCoord } from '$lib/geo';
import { lookupWard } from '$lib/wards';

const CCC_URL =
	'https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Corporate_Contact_Centre_Requests/FeatureServer/0/query';
const CCC_RADIUS_M = 200;

// GET /api/ccc/[id]
// Fetches Kitchener CCC repair request data near the pothole from ArcGIS.
// Running server-side keeps pothole coordinates off the browser→ArcGIS path
// and moves the ArcGIS latency (up to 5 s) off the SSR critical path —
// callers fetch this endpoint from a $effect after the page has painted.
export const GET: RequestHandler = async ({ params }) => {
	const parsed = z.object({ id: z.string().uuid() }).safeParse(params);
	if (!parsed.success) throw error(400, 'Invalid ID');

	const { data, error: dbErr } = await supabase
		.from('potholes')
		.select('lat, lng')
		.eq('id', parsed.data.id)
		.single();
	if (dbErr || !data) throw error(404, 'Pothole not found');

	const { lat, lng } = data;

	// Server-side city gate — the CCC dataset only covers Kitchener repairs.
	// Sending coordinates for Waterloo/Cambridge potholes to ArcGIS would waste
	// a network call and could leak coordinates unnecessarily.
	const ward = await lookupWard(lat, lng).catch(() => null);
	if (ward?.city !== 'kitchener') return json([]);

	// Round coords before sending to ArcGIS — matches ~11 m public precision
	// disclosure and prevents full-precision leakage for historical rows.
	const params2 = new URLSearchParams({
		where: "REQUEST_NAME='Potholes_Hot_Mix_Repairs'",
		geometry: `${roundPublicCoord(lng)},${roundPublicCoord(lat)}`,
		geometryType: 'esriGeometryPoint',
		inSR: '4326',
		spatialRel: 'esriSpatialRelIntersects',
		distance: String(CCC_RADIUS_M),
		units: 'esriSRUnit_Meter',
		outFields: 'INTERSECTION,CREATE_DATE',
		orderByFields: 'CREATE_DATE DESC',
		resultRecordCount: '5',
		returnGeometry: 'false',
		f: 'json'
	});

	try {
		const res = await fetch(`${CCC_URL}?${params2}`, {
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return json([]);
		const body = await res.json();
		const features: unknown[] = Array.isArray(body.features) ? body.features : [];
		const requests = features.flatMap((f) => {
			if (
				typeof f !== 'object' ||
				f === null ||
				!('attributes' in f) ||
				typeof (f as Record<string, unknown>).attributes !== 'object'
			)
				return [];
			const attrs = (f as { attributes: Record<string, unknown> }).attributes;
			const intersection = attrs.INTERSECTION;
			const createDate = attrs.CREATE_DATE;
			if (typeof intersection !== 'string' || !intersection) return [];
			if (typeof createDate !== 'number') return [];
			const date = new Date(createDate);
			if (isNaN(date.getTime())) return [];
			return [{ intersection, date: date.toISOString().slice(0, 10) }];
		});
		return json(requests);
	} catch (err) {
		logError('api/ccc', 'ArcGIS CCC fetch failed', err, { potholeId: parsed.data.id });
		return json([]);
	}
};
