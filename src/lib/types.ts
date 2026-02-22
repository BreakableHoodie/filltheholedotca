export type PotholeStatus = 'pending' | 'reported' | 'wanksyd' | 'filled';

export interface Pothole {
	id: string;
	created_at: string;
	lat: number;
	lng: number;
	address: string | null;
	description: string | null;
	status: PotholeStatus;
	confirmed_count: number;
	wanksy_at: string | null;
	filled_at: string | null;
}
