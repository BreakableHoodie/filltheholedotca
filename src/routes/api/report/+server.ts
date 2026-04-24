import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { hashIp } from '$lib/hash';
import { roundPublicCoord, haversineMetres } from '$lib/geo';
import { GEOFENCE, MERGE_RADIUS_M } from '$lib/constants';
import { getConfirmationThreshold } from '$lib/server/settings';
import { notify } from '$lib/server/pushover';
import { postConfirmed } from '$lib/server/bluesky';
import { logError } from '$lib/server/observability';
import { getAdminClient } from '$lib/server/supabase';

type FixturePothole = { id: string; lat: number; lng: number; confirmed_count: number };
const fixturePotholes = new Map<string, FixturePothole>();

const REPORT_RATE_LIMIT = 20;
const REPORT_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SEVERITY_VALUES = ['Minor damage', 'Moderate damage', 'Severe damage', 'Hazardous'] as const;

const reportSchema = z.object({
	lat: z.number().finite().min(-90).max(90),
	lng: z.number().finite().min(-180).max(180),
	address: z.string().trim().max(255).nullable().optional(),
	description: z.enum(SEVERITY_VALUES).nullable().optional()
});

type ConfirmationResult =
	| { duplicate: true }
	| { duplicate: false; confirmed_count: number; status: string };

export const DELETE: RequestHandler = async () => {
	if (process.env.PLAYWRIGHT_E2E_FIXTURES !== 'true') throw error(405, 'Method not allowed');
	fixturePotholes.clear();
	return json({ ok: true });
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = reportSchema.safeParse(raw);

	if (!parsed.success) {
		throw error(400, 'Invalid report data');
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

	if (process.env.PLAYWRIGHT_E2E_FIXTURES === 'true') {
		// Iterate Map values directly so we hold a reference to the stored object
		// (not a spread copy) and can mutate confirmed_count in place.
		let closestMatch: FixturePothole | undefined;
		let closestDist = Infinity;
		for (const p of fixturePotholes.values()) {
			const dist = haversineMetres(lat, lng, p.lat, p.lng);
			if (dist <= MERGE_RADIUS_M && dist < closestDist) {
				closestMatch = p;
				closestDist = dist;
			}
		}

		if (closestMatch) {
			closestMatch.confirmed_count += 1;
			const confirmed = closestMatch.confirmed_count >= 2;
			return json({
				id: closestMatch.id,
				confirmed,
				message: confirmed
					? '✅ Confirmed — pothole is now live on the map!'
					: `📍 Confirmation noted (${closestMatch.confirmed_count}/2 needed).`
			});
		}

		const id = crypto.randomUUID();
		fixturePotholes.set(id, { id, lat: roundPublicCoord(lat), lng: roundPublicCoord(lng), confirmed_count: 1 });
		return json({
			id,
			confirmed: false,
			message: '📍 Pothole logged. More independent reports from this location will put it on the map.'
		});
	}

	const ipHash = await hashIp(getClientAddress());

	// Persistent per-IP report throttling.
	const windowStart = new Date(Date.now() - REPORT_RATE_WINDOW_MS).toISOString();
	const { count: recentReports, error: reportRateError } = await getAdminClient()
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'report_submit')
		.gte('created_at', windowStart);

	if (reportRateError) throw error(500, 'Failed to check report rate limit');
	if ((recentReports ?? 0) >= REPORT_RATE_LIMIT) {
		throw error(429, 'Too many report attempts. Please wait before trying again.');
	}

	const { error: reportRateInsertError } = await getAdminClient()
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'report_submit' });

	if (reportRateInsertError) {
		// Non-fatal: log and continue. A broken rate-limit table should not block
		// legitimate reports — the next check will simply see a lower count.
		logError('report', 'Failed to record rate limit event', reportRateInsertError, { ipHashPrefix: ipHash.slice(0, 8) });
	}

	// Search for existing pending potholes nearby using a bounding box
	const delta = 0.0005;
	const { data: nearby, error: queryError } = await getAdminClient()
		.from('potholes')
		.select('id, lat, lng, confirmed_count, address')
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
		const confirmationsRequired = await getConfirmationThreshold();
		// C1 fix: use service-role client so this RPC is unreachable via the public anon key.
		// Calling via the anon client exposes it to the public Supabase REST API, allowing
		// anyone to supply an arbitrary p_ip_hash or p_threshold and bypass all guards.
		const { data: result, error: rpcError } = await getAdminClient().rpc('increment_confirmation', {
			p_pothole_id: match.id,
			p_ip_hash: ipHash,
			p_threshold: confirmationsRequired
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

		// Fire when this confirmation caused the status to flip to 'reported'.
		// Duplicate posts from concurrent confirmations are rare and acceptable — the DB
		// RPC uses row-level locking so the window is tiny. Checking equality against the
		// threshold breaks when an admin lowers the threshold after a pothole already has
		// more confirmations than the new value (status flips but count > threshold).
		if (rpc.status === 'reported') {
			// Fire-and-forget — do not block the public response on external API latency.
			// Use the stored address for Pushover (admin-only) but pass null to the Bluesky
			// post — match.address is user-controlled text from the first reporter and must
			// not appear verbatim in public posts. postConfirmed falls back to "Waterloo Region".
			const storedAddress = match.address;
			const locationLabel = storedAddress?.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
			void notify('community', {
				title: '🕳️ Pothole confirmed — now live',
				message: `Pothole at ${locationLabel} reached the confirmation threshold and is now on the public map.`,
				url: `https://fillthehole.ca/hole/${match.id}`,
				urlTitle: 'View pothole',
				priority: -1
			});
			void postConfirmed(match.id, null);
		}

		return json({
			id: match.id,
			confirmed: rpc.status === 'reported',
			message:
				rpc.status === 'reported'
					? '✅ Confirmed — pothole is now live on the map!'
					: `📍 Confirmation noted (${rpc.confirmed_count}/${confirmationsRequired} needed).`
		});
	}

	// First report — insert as pending with count 1.
	// Round to ~11m precision before persistence so we never store a reporter's
	// exact GPS fix. The geofence check and the new-report side of the merge
	// haversine use raw coords; stored pothole coords are already rounded, so
	// merge comparisons carry ≤ ~7 m precision loss — accepted given the 25 m radius.
	const { data, error: insertError } = await getAdminClient()
		.from('potholes')
		.insert({
			lat: roundPublicCoord(lat),
			lng: roundPublicCoord(lng),
			address: address ?? null,
			description: description ?? null,
			status: 'pending',
			confirmed_count: 1
		})
		.select('id')
		.single();

	if (insertError) throw error(500, 'Failed to submit report');

	// Record the first confirmation — no conflict possible for a brand-new pothole
	await getAdminClient().from('pothole_confirmations').insert({ pothole_id: data.id, ip_hash: ipHash });

	return json({
		id: data.id,
		confirmed: false,
		message:
			'📍 Pothole logged. More independent reports from this location will put it on the map.'
	});
};
