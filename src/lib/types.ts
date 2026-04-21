export type PotholeStatus = 'pending' | 'reported' | 'filled' | 'expired';

// 'deferred' = SightEngine was unavailable; photo is hidden until an admin reviews it manually.
export type PhotoModerationStatus = 'pending' | 'approved' | 'rejected' | 'deferred';

export interface PotholePhoto {
	id: string;
	pothole_id: string;
	storage_path: string;
	moderation_status: PhotoModerationStatus;
	moderation_score: number | null;
	created_at: string;
	/** Full-resolution public URL, constructed server-side from storage_path. */
	url: string;
	/** Resized thumbnail URL via Supabase Image Transformation (800 px wide). Falls back to url if the feature is not enabled. */
	thumbnailUrl: string;
}

export interface Pothole {
	id: string;
	created_at: string;
	lat: number;
	lng: number;
	address: string | null;
	description: string | null;
	status: PotholeStatus;
	confirmed_count: number;
	filled_at: string | null;
	expired_at: string | null;
	photos_published: boolean;
}
