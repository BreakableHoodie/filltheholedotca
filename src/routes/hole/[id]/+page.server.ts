import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Pothole, PotholePhoto } from '$lib/types';
import { lookupWard } from '$lib/wards';
import { decodeHtmlEntities } from '$lib/escape';

const CCC_URL = 'https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Corporate_Contact_Centre_Requests/FeatureServer/0/query';
const CCC_RADIUS_M = 200;

export interface CityRepairRequest {
	intersection: string;
	date: string; // ISO date string
}

async function fetchCityRepairRequests(lat: number, lng: number): Promise<CityRepairRequest[]> {
	const params = new URLSearchParams({
		where: "REQUEST_NAME='Potholes_Hot_Mix_Repairs'",
		geometry: `${lng},${lat}`,
		geometryType: 'esriGeometryPoint',
		inSR: '4326',
		spatialRel: 'esriSpatialRelIntersects',
		distance: String(CCC_RADIUS_M),
		units: 'esriSRUnit_Meter',
		outFields: 'INTERSECTION,CREATE_DATE',
		orderByFields: 'CREATE_DATE DESC',
		resultRecordCount: '5',
		returnGeometry: 'false',
		f: 'json'
	});

	try {
		const res = await fetch(`${CCC_URL}?${params}`, {
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return [];
		const json = await res.json();
		const features: { attributes: { INTERSECTION: string; CREATE_DATE: number } }[] =
			json.features ?? [];
		return features.map((f) => ({
			intersection: f.attributes.INTERSECTION,
			date: new Date(f.attributes.CREATE_DATE).toISOString().slice(0, 10)
		}));
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ params, url }) => {
	const { data, error: dbError } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, address, description, status, confirmed_count, filled_at, expired_at')
		.eq('id', params.id)
		.single();

	if (dbError || !data) {
		throw error(404, 'Hole not found');
	}

	const pothole = {
		...data,
		address: data.address ? decodeHtmlEntities(data.address) : null,
		description: data.description ? decodeHtmlEntities(data.description) : null
	} as Pothole;
	const [councillor, cityRepairRequests, photosResult] = await Promise.all([
		lookupWard(pothole.lat, pothole.lng),
		fetchCityRepairRequests(pothole.lat, pothole.lng),
		supabase
			.from('pothole_photos')
			.select('id, storage_path, created_at')
			.eq('pothole_id', params.id)
			.eq('moderation_status', 'approved')
			.order('created_at', { ascending: true })
	]);

	const photos: PotholePhoto[] = (photosResult.data ?? []).map((p) => ({
		...p,
		pothole_id: params.id,
		moderation_status: 'approved' as const,
		moderation_score: null,
		url: supabase.storage.from('pothole-photos').getPublicUrl(p.storage_path).data.publicUrl
	}));

	return { pothole, councillor, cityRepairRequests, photos, origin: url.origin };
};
