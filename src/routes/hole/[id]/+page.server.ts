import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Pothole } from '$lib/types';
import { lookupWard } from '$lib/wards';

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
		.select('*')
		.eq('id', params.id)
		.single();

	if (dbError || !data) {
		throw error(404, 'Hole not found');
	}

	const pothole = data as Pothole;
	const [councillor, cityRepairRequests] = await Promise.all([
		lookupWard(pothole.lat, pothole.lng),
		fetchCityRepairRequests(pothole.lat, pothole.lng)
	]);

	return { pothole, councillor, cityRepairRequests, origin: url.origin };
};
