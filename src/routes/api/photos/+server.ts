import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { hashIp } from '$lib/hash';
import { notify } from '$lib/server/pushover';
import { logError } from '$lib/server/observability';
import { stripJpegMetadata } from '$lib/server/exif-strip';
import { getAdminClient } from '$lib/server/supabase';

type DetectedMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
type DetectedExtension = 'jpg' | 'png' | 'webp';

const ALLOWED_TYPES = new Set<DetectedMimeType>(['image/jpeg', 'image/png', 'image/webp']);
const ACTIVE_UPLOAD_STATUSES = new Set(['pending', 'reported']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ACTIVE_PHOTOS_PER_POTHOLE = 5;
const MODERATION_THRESHOLD = 0.5;
const PHOTO_RATE_LIMIT = 3;
const PHOTO_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Service role client — bypasses RLS for storage and DB writes.
// Never use this key in client-side code.
interface SightEngineResponse {
	status: string;
	nudity?: { sexual_activity?: number; sexual_display?: number };
	offensive?: { prob?: number };
}

interface SightEngineWorkflowResponse {
	status: string;
	summary?: {
		action: 'accept' | 'reject';
		reject_prob?: number;
		reject_reasons?: string[];
	};
}

function detectImageType(bytes: Uint8Array): { mimeType: DetectedMimeType; ext: DetectedExtension } | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return { mimeType: 'image/jpeg', ext: 'jpg' };
	}
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return { mimeType: 'image/png', ext: 'png' };
	}
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return { mimeType: 'image/webp', ext: 'webp' };
	}
	return null;
}

type ModerationResult = { score: number | null; rejected: boolean; deferred?: boolean };

async function runModeration(
	bytes: Uint8Array,
	mimeType: DetectedMimeType,
	ext: DetectedExtension
): Promise<ModerationResult> {
	const workflowId = env.SIGHTENGINE_WORKFLOW_ID;

	const apiUser = env.SIGHTENGINE_API_USER;
	const apiSecret = env.SIGHTENGINE_API_SECRET;
	if (!apiUser || !apiSecret) return { score: null, rejected: false, deferred: true };

	try {
		const seForm = new FormData();
		// Cast Uint8Array<ArrayBufferLike> → BlobPart: TS 6 widened typed-array
		// buffers to accept SharedArrayBuffer, but at runtime bytes always comes
		// from file.arrayBuffer() or stripJpegMetadata — both ArrayBuffer-backed.
		seForm.append('media', new Blob([bytes as unknown as BlobPart], { type: mimeType }), `photo.${ext}`);
		seForm.append('api_user', apiUser);
		seForm.append('api_secret', apiSecret);

		if (workflowId) {
			// Workflow mode — rules and thresholds are configured in the SightEngine
			// dashboard. The API just returns accept/reject + a reject probability.
			seForm.append('workflow', workflowId);
			const res = await fetch('https://api.sightengine.com/1.0/check-workflow.json', {
				method: 'POST',
				body: seForm,
				signal: AbortSignal.timeout(10_000)
			});
			if (!res.ok) return { score: null, rejected: false, deferred: true };
			const data: SightEngineWorkflowResponse = await res.json();
			if (data.status !== 'success' || !data.summary) return { score: null, rejected: false, deferred: true };
			return {
				score: data.summary.reject_prob ?? null,
				rejected: data.summary.action === 'reject'
			};
		}

		// Legacy fallback: manual model scoring (no workflow ID configured).
		seForm.append('models', 'nudity,offensive');
		const res = await fetch('https://api.sightengine.com/1.0/check.json', {
			method: 'POST',
			body: seForm,
			signal: AbortSignal.timeout(10_000)
		});
		if (!res.ok) return { score: null, rejected: false, deferred: true };
		const data: SightEngineResponse = await res.json();
		if (data.status !== 'success') return { score: null, rejected: false, deferred: true };
		const nudityScore = Math.max(data.nudity?.sexual_activity ?? 0, data.nudity?.sexual_display ?? 0);
		const offensiveScore = data.offensive?.prob ?? 0;
		const score = Math.max(nudityScore, offensiveScore);
		return { score, rejected: score > MODERATION_THRESHOLD };
	} catch (err) {
		// H3 fix: fail to a distinct 'deferred' state rather than silently passing.
		// An attacker who disrupts SightEngine would previously bypass automated moderation
		// entirely. Now the photo is uploaded but flagged for mandatory admin review.
		logError('photos/moderation', 'SightEngine check failed — photo will require manual admin review', err);
		return { score: null, rejected: false, deferred: true };
	}
}

async function cleanupStorageObject(storagePath: string): Promise<void> {
	const { error: cleanupError } = await getAdminClient().storage.from('pothole-photos').remove([storagePath]);
	if (cleanupError) {
		logError('photos/cleanup', 'Failed to clean up orphaned storage object', cleanupError, { storagePath });
	}
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		throw error(400, 'Invalid form data');
	}

	const file = formData.get('photo');
	const rawPotholeId = formData.get('pothole_id');

	const idParsed = z.string().uuid().safeParse(rawPotholeId);
	if (!idParsed.success) throw error(400, 'Invalid pothole ID');

	if (!(file instanceof File)) throw error(400, 'No photo provided');
	if (file.size > MAX_SIZE_BYTES) throw error(413, 'Photo too large (max 5 MB)');

	const ipHash = await hashIp(getClientAddress());

	// Persistent rate limit to prevent storage and moderation abuse.
	const windowStart = new Date(Date.now() - PHOTO_RATE_WINDOW_MS).toISOString();
	const { count: recentUploads, error: rateLimitError } = await getAdminClient()
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'photo_upload')
		.gte('created_at', windowStart);
	if (rateLimitError) throw error(500, 'Failed to check upload rate limit');
	if ((recentUploads ?? 0) >= PHOTO_RATE_LIMIT) {
		throw error(429, 'Too many photo uploads. Please wait before trying again.');
	}

	// Confirm the pothole exists and still accepts photos.
	const { data: pothole, error: potholeError } = await getAdminClient()
		.from('potholes')
		.select('id, status')
		.eq('id', idParsed.data)
		.maybeSingle();
	if (potholeError) throw error(500, 'Failed to verify pothole status');
	if (!pothole) throw error(404, 'Pothole not found');
	if (!ACTIVE_UPLOAD_STATUSES.has(pothole.status)) {
		throw error(409, 'Photos are only allowed for pending or reported potholes');
	}

	const { error: rateLimitInsertError } = await getAdminClient()
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'photo_upload' });
	if (rateLimitInsertError) {
		logError('photos/ratelimit', 'Failed to record rate limit event', rateLimitInsertError, { ipHashPrefix: ipHash.slice(0, 8) });
	}

	// Prevent unlimited media accumulation on a single pothole.
	const { count: activePhotoCount, error: activePhotoCountError } = await getAdminClient()
		.from('pothole_photos')
		.select('*', { count: 'exact', head: true })
		.eq('pothole_id', idParsed.data)
		.neq('moderation_status', 'rejected');
	if (activePhotoCountError) throw error(500, 'Failed to check photo limit');
	if ((activePhotoCount ?? 0) >= MAX_ACTIVE_PHOTOS_PER_POTHOLE) {
		throw error(409, 'This pothole already has the maximum number of active photos');
	}

	const rawBytes = new Uint8Array(await file.arrayBuffer());
	const detectedType = detectImageType(rawBytes);
	if (!detectedType || !ALLOWED_TYPES.has(detectedType.mimeType)) {
		throw error(400, 'Invalid file type — JPEG, PNG, or WebP only');
	}
	const { mimeType, ext } = detectedType;

	// Strip EXIF/XMP/ICC from JPEGs before the bytes are stored or moderated.
	// Mobile cameras embed GPS coords, device serials, and timestamps that
	// defeat the write-time coord rounding applied to the DB row. PNG/WebP
	// rarely carry camera EXIF from mobile uploads and pass through untouched.
	const cleanBytes = mimeType === 'image/jpeg' ? stripJpegMetadata(rawBytes) : rawBytes;

	const photoId = crypto.randomUUID();
	const storagePath = `${idParsed.data}/${photoId}.${ext}`;

	// Run SightEngine moderation (non-blocking on failure)
	const moderation = await runModeration(cleanBytes, mimeType, ext);

	if (moderation.rejected) {
		throw error(422, 'Photo rejected by content moderation');
	}

	// Upload to Supabase Storage
	const { error: uploadError } = await getAdminClient().storage
		.from('pothole-photos')
		.upload(storagePath, cleanBytes, { contentType: mimeType, upsert: false });

	if (uploadError) {
		logError('photos/upload', 'Storage upload failed', uploadError, { storagePath });
		throw error(500, 'Upload failed — please try again');
	}

	// Insert DB record. Status is 'pending' (normal flow) or 'deferred' (SightEngine
	// unavailable). Both are hidden from the public; only admins see them in the queue.
	// 'deferred' is visually distinct in the admin UI so it gets prioritised for review.
	const { data: photo, error: insertError } = await getAdminClient()
		.from('pothole_photos')
		.insert({
			pothole_id: idParsed.data,
			storage_path: storagePath,
			moderation_status: moderation.deferred ? 'deferred' : 'pending',
			moderation_score: moderation.score,
			ip_hash: ipHash
		})
		.select('id')
		.single();

	if (insertError || !photo) {
		logError('photos/insert', 'Failed to insert photo DB record — storage cleanup triggered', insertError ?? new Error('no photo returned'), { storagePath });
		await cleanupStorageObject(storagePath);
		throw error(500, 'Failed to save photo record');
	}

	// Fire-and-forget — do not block the client response on Pushover latency.
	// Deferred photos get higher priority since SightEngine was down.
	void notify('photos', {
		title: moderation.deferred ? '⚠️ Photo needs review (SightEngine down)' : '📸 New photo to review',
		message: moderation.deferred
			? 'SightEngine was unavailable — automated moderation skipped. Manual review required.'
			: 'A new photo passed automated moderation and is waiting for admin approval.',
		url: `https://fillthehole.ca/admin`,
		urlTitle: 'Open admin panel',
		priority: moderation.deferred ? 1 : 0
	});

	return json({ ok: true, id: photo.id });
};
