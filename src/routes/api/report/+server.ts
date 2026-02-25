import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { hashIp } from '$lib/hash';

/** Encode HTML entities in user-supplied strings before persistence. */
function sanitize(s: string): string {
	return s.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c] ?? c
	);
}

// Create Supabase client only when needed, not at module level
function getSupabaseClient() {
	try {
		return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	} catch (error) {
		console.error('Failed to create Supabase client:', error);
		throw new Error('Database connection failed');
	}
}

// Kitchener–Waterloo–Cambridge (Waterloo Region), ON bounding box
const GEOFENCE = {
	latMin: 43.32,
	latMax: 43.53,
	lngMin: -80.59,
	lngMax: -80.22
};

const MERGE_RADIUS_M = 25;
const CONFIRMATIONS_REQUIRED = 3;

const reportSchema = z.object({
	lat: z.number().finite().min(-90).max(90),
	lng: z.number().finite().min(-180).max(180),
	address: z.string().trim().max(255).nullable().optional(),
	description: z.string().trim().max(500).nullable().optional()
});

type ConfirmationResult =
	| { duplicate: true }
	| { duplicate: false; confirmed_count: number; status: string };

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371000;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = reportSchema.safeParse(raw);

	if (!parsed.success) {
		throw error(400, 'Missing or invalid coordinates');
	}

	const { lat, lng, address, description } = parsed.data;

	// Geofence check
	if (
		lat < GEOFENCE.latMin ||
		lat > GEOFENCE.latMax ||
		lng < GEOFENCE.lngMin ||
		lng > GEOFENCE.lngMax
	) {
		throw error(
			422,
			"That location isn't in the Waterloo Region. This tool covers Kitchener, Waterloo, and Cambridge."
		);
	}

	const ipHash = await hashIp(getClientAddress());

	// Initialize Supabase client after geofence validation
	let supabase;
	try {
		supabase = getSupabaseClient();
	} catch {
		throw error(500, 'Database connection failed');
	}

	// Search for existing pending potholes nearby using a bounding box
	const delta = 0.0005;
	const { data: nearby, error: queryError } = await supabase
		.from('potholes')
		.select('id, lat, lng, confirmed_count')
		.eq('status', 'pending')
		.gte('lat', lat - delta)
		.lte('lat', lat + delta)
		.gte('lng', lng - delta * 1.4)
		.lte('lng', lng + delta * 1.4);

	if (queryError) throw error(500, 'Failed to check nearby reports');

	// Find the closest pending pothole within merge radius
	const match = nearby
		?.map((p) => ({ ...p, dist: haversineMetres(lat, lng, p.lat, p.lng) }))
		.filter((p) => p.dist <= MERGE_RADIUS_M)
		.sort((a, b) => a.dist - b.dist)[0];

	if (match) {
		// Atomically insert confirmation and increment count via RPC.
		// The RPC handles duplicate IPs (ON CONFLICT DO NOTHING) and the
		// confirmed_count increment in a single statement, preventing race conditions.
		const { data: result, error: rpcError } = await supabase.rpc('increment_confirmation', {
			p_pothole_id: match.id,
			p_ip_hash: ipHash
		});

		if (rpcError) throw error(500, 'Failed to update report');

		const rpc = result as ConfirmationResult;

		if (rpc.duplicate) {
			return json({
				id: match.id,
				confirmed: false,
				message: "📍 You've already reported this one. Thanks though!"
			});
		}

		return json({
			id: match.id,
			confirmed: rpc.status === 'reported',
			message:
				rpc.status === 'reported'
					? '✅ Confirmed — pothole is now live on the map!'
					: `📍 Confirmation noted (${rpc.confirmed_count}/${CONFIRMATIONS_REQUIRED} needed).`
		});
	}

	// First report — insert as pending with count 1
	const { data, error: insertError } = await supabase
		.from('potholes')
		.insert({
			lat,
			lng,
			address: address ? sanitize(address.trim()) : null,
			description: description ? sanitize(description.trim()) : null,
			status: 'pending',
			confirmed_count: 1
		})
		.select('id')
		.single();

	if (insertError) throw error(500, 'Failed to submit report');

	// Record the first confirmation — no conflict possible for a brand-new pothole
	await supabase.from('pothole_confirmations').insert({ pothole_id: data.id, ip_hash: ipHash });

	return json({
		id: data.id,
		confirmed: false,
		message:
			'📍 Pothole logged. More independent reports from this location will put it on the map.'
	});
};
