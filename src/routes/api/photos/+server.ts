import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SUPABASE_SERVICE_ROLE_KEY, SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MODERATION_THRESHOLD = 0.5;

// Service role client — bypasses RLS for storage and DB writes.
// Never use this key in client-side code.
const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface SightEngineResponse {
	status: string;
	nudity?: { sexual_activity?: number; sexual_display?: number };
	offensive?: { prob?: number };
}

async function runModeration(buffer: ArrayBuffer, mimeType: string, ext: string): Promise<number | null> {
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

export const POST: RequestHandler = async ({ request }) => {
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
	if (!ALLOWED_TYPES.has(file.type)) throw error(400, 'Invalid file type — JPEG, PNG, or WebP only');
	if (file.size > MAX_SIZE_BYTES) throw error(413, 'Photo too large (max 5 MB)');

	// Confirm the pothole exists before accepting the upload
	const { data: pothole } = await adminSupabase.from('potholes').select('id').eq('id', idParsed.data).single();
	if (!pothole) throw error(404, 'Pothole not found');

	const buffer = await file.arrayBuffer();
	const ext = file.type === 'image/png' ? 'png' : 'jpg';
	const photoId = crypto.randomUUID();
	const storagePath = `${idParsed.data}/${photoId}.${ext}`;

	// Run SightEngine moderation (non-blocking on failure)
	const moderationScore = await runModeration(buffer, file.type, ext);

	if (moderationScore !== null && moderationScore > MODERATION_THRESHOLD) {
		throw error(422, 'Photo rejected by content moderation');
	}

	// Upload to Supabase Storage
	const { error: uploadError } = await adminSupabase.storage
		.from('pothole-photos')
		.upload(storagePath, buffer, { contentType: file.type, upsert: false });

	if (uploadError) {
		console.error('[photos] Storage upload failed:', uploadError);
		throw error(500, 'Upload failed — please try again');
	}

	// Insert DB record — photo stays in 'pending' until an admin approves it
	const { data: photo, error: insertError } = await adminSupabase
		.from('pothole_photos')
		.insert({ pothole_id: idParsed.data, storage_path: storagePath, moderation_score: moderationScore })
		.select('id')
		.single();

	if (insertError || !photo) {
		// Clean up the orphaned storage object
		await adminSupabase.storage.from('pothole-photos').remove([storagePath]);
		throw error(500, 'Failed to save photo record');
	}

	return json({ ok: true, id: photo.id });
};
