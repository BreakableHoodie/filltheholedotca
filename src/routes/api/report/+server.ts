import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

// Kitchener–Waterloo–Cambridge (Waterloo Region), ON bounding box
const GEOFENCE = {
	latMin: 43.32,
	latMax: 43.53,
	lngMin: -80.59,
	lngMax: -80.22
};

const MERGE_RADIUS_M = 50;
const CONFIRMATIONS_REQUIRED = 3;

const reportSchema = z.object({
	lat: z.number().finite().min(-90).max(90),
	lng: z.number().finite().min(-180).max(180),
	address: z.string().max(255).nullable().optional(),
	description: z.string().max(500).nullable().optional()
});

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
		lat < GEOFENCE.latMin || lat > GEOFENCE.latMax ||
		lng < GEOFENCE.lngMin || lng > GEOFENCE.lngMax
	) {
		throw error(422, "That location isn't in the Waterloo Region. This tool covers Kitchener, Waterloo, and Cambridge.");
	}

	// Hash the client IP for deduplication (never store raw IP)
	const ip = getClientAddress();
	const ipHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
		.then((buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

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
		// Check if this IP already confirmed this pothole
		const { data: existing } = await supabase
			.from('pothole_confirmations')
			.select('id')
			.eq('pothole_id', match.id)
			.eq('ip_hash', ipHash)
			.maybeSingle();

		if (existing) {
			return json({
				id: match.id,
				confirmed: false,
				message: '📍 You\'ve already reported this one. Thanks though!'
			});
		}

		// Log this confirmation
		await supabase.from('pothole_confirmations').insert({ pothole_id: match.id, ip_hash: ipHash });

		const newCount = match.confirmed_count + 1;
		const newStatus = newCount >= CONFIRMATIONS_REQUIRED ? 'reported' : 'pending';

		const { error: updateError } = await supabase
			.from('potholes')
			.update({ confirmed_count: newCount, status: newStatus })
			.eq('id', match.id);

		if (updateError) throw error(500, 'Failed to update report');

		return json({
			id: match.id,
			confirmed: newStatus === 'reported',
			message:
				newStatus === 'reported'
					? '✅ Confirmed — pothole is now live on the map!'
					: `📍 Confirmation noted (${newCount}/${CONFIRMATIONS_REQUIRED} needed).`
		});
	}

	// First report — log confirmation and insert as pending
	const { data, error: insertError } = await supabase
		.from('potholes')
		.insert({
			lat,
			lng,
			address: address?.trim() || null,
			description: description?.trim() || null,
			status: 'pending',
			confirmed_count: 1
		})
		.select('id')
		.single();

	if (insertError) throw error(500, 'Failed to submit report');

	// Log the first confirmation
	await supabase.from('pothole_confirmations').insert({ pothole_id: data.id, ip_hash: ipHash });

	return json({
		id: data.id,
		confirmed: false,
		message: '📍 Pothole logged. More independent reports from this location will put it on the map.'
	});
};
