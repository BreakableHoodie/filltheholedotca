export type PotholeStatus = 'pending' | 'reported' | 'filled' | 'expired';

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
