export type PotholeStatus = 'pending' | 'reported' | 'filled' | 'expired';

export type PhotoModerationStatus = 'pending' | 'approved' | 'rejected';

export interface PotholePhoto {
	id: string;
	pothole_id: string;
	storage_path: string;
	moderation_status: PhotoModerationStatus;
	moderation_score: number | null;
	created_at: string;
	/** Constructed server-side from storage_path. */
	url: string;
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
}
