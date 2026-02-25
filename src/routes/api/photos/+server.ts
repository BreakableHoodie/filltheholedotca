import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SUPABASE_SERVICE_ROLE_KEY, SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { hashIp } from '$lib/hash';

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
const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface SightEngineResponse {
	status: string;
	nudity?: { sexual_activity?: number; sexual_display?: number };
	offensive?: { prob?: number };
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

async function runModeration(
	buffer: ArrayBuffer,
	mimeType: DetectedMimeType,
	ext: DetectedExtension
): Promise<number | null> {
	try {
		const seForm = new FormData();
		seForm.append('media', new Blob([buffer], { type: mimeType }), `photo.${ext}`);
		seForm.append('models', 'nudity,offensive');
		seForm.append('api_user', SIGHTENGINE_API_USER);
		seForm.append('api_secret', SIGHTENGINE_API_SECRET);

		const res = await fetch('https://api.sightengine.com/1.0/check.json', {
			method: 'POST',
			body: seForm,
			signal: AbortSignal.timeout(10_000)
		});

		if (!res.ok) return null;

		const data: SightEngineResponse = await res.json();
		if (data.status !== 'success') return null;

		const nudityScore = Math.max(data.nudity?.sexual_activity ?? 0, data.nudity?.sexual_display ?? 0);
		const offensiveScore = data.offensive?.prob ?? 0;
		return Math.max(nudityScore, offensiveScore);
	} catch {
		console.warn('[photos] SightEngine check failed — deferring photo to manual review');
		return null;
	}
}

async function cleanupStorageObject(storagePath: string): Promise<void> {
	const { error: cleanupError } = await adminSupabase.storage.from('pothole-photos').remove([storagePath]);
	if (cleanupError) {
		console.error('[photos] Failed to clean up orphaned storage object:', cleanupError);
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
	const { count: recentUploads, error: rateLimitError } = await adminSupabase
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'photo_upload')
		.gte('created_at', windowStart);
	if (rateLimitError) throw error(500, 'Failed to check upload rate limit');
	if ((recentUploads ?? 0) >= PHOTO_RATE_LIMIT) {
		throw error(429, 'Too many photo uploads. Please wait before trying again.');
	}

	const { error: rateLimitInsertError } = await adminSupabase
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'photo_upload' });
	if (rateLimitInsertError) throw error(500, 'Failed to record upload rate limit');

	// Confirm the pothole exists and still accepts photos.
	const { data: pothole, error: potholeError } = await adminSupabase
		.from('potholes')
		.select('id, status')
		.eq('id', idParsed.data)
		.single();
	if (potholeError) throw error(500, 'Failed to verify pothole status');
	if (!pothole) throw error(404, 'Pothole not found');
	if (!ACTIVE_UPLOAD_STATUSES.has(pothole.status)) {
		throw error(409, 'Photos are only allowed for pending or reported potholes');
	}

	// Prevent unlimited media accumulation on a single pothole.
	const { count: activePhotoCount, error: activePhotoCountError } = await adminSupabase
		.from('pothole_photos')
		.select('*', { count: 'exact', head: true })
		.eq('pothole_id', idParsed.data)
		.neq('moderation_status', 'rejected');
	if (activePhotoCountError) throw error(500, 'Failed to check photo limit');
	if ((activePhotoCount ?? 0) >= MAX_ACTIVE_PHOTOS_PER_POTHOLE) {
		throw error(409, 'This pothole already has the maximum number of active photos');
	}

	const buffer = await file.arrayBuffer();
	const detectedType = detectImageType(new Uint8Array(buffer));
	if (!detectedType || !ALLOWED_TYPES.has(detectedType.mimeType)) {
		throw error(400, 'Invalid file type — JPEG, PNG, or WebP only');
	}
	const { mimeType, ext } = detectedType;
	const photoId = crypto.randomUUID();
	const storagePath = `${idParsed.data}/${photoId}.${ext}`;

	// Run SightEngine moderation (non-blocking on failure)
	const moderationScore = await runModeration(buffer, mimeType, ext);

	if (moderationScore !== null && moderationScore > MODERATION_THRESHOLD) {
		throw error(422, 'Photo rejected by content moderation');
	}

	// Upload to Supabase Storage
	const { error: uploadError } = await adminSupabase.storage
		.from('pothole-photos')
		.upload(storagePath, buffer, { contentType: mimeType, upsert: false });

	if (uploadError) {
		console.error('[photos] Storage upload failed:', uploadError);
		throw error(500, 'Upload failed — please try again');
	}

	// Insert DB record — photo stays in 'pending' until an admin approves it
	const { data: photo, error: insertError } = await adminSupabase
		.from('pothole_photos')
		.insert({
			pothole_id: idParsed.data,
			storage_path: storagePath,
			moderation_score: moderationScore,
			ip_hash: ipHash
		})
		.select('id')
		.single();

	if (insertError || !photo) {
		await cleanupStorageObject(storagePath);
		throw error(500, 'Failed to save photo record');
	}

	return json({ ok: true, id: photo.id });
};
