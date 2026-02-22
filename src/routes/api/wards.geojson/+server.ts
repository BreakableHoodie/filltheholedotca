import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const SOURCES = [
	{
		city: 'kitchener',
		url: 'https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Wards/FeatureServer/0/query?where=1%3D1&outFields=WARDID&outSR=4326&f=geojson',
		wardField: 'WARDID'
	},
	{
		city: 'waterloo',
		url: 'https://services.arcgis.com/ZpeBVw5o1kjit7LT/arcgis/rest/services/Wards2022/FeatureServer/0/query?where=1%3D1&outFields=WARD_NO&outSR=4326&f=geojson',
		wardField: 'WARD_NO'
	},
	{
		city: 'cambridge',
		url: 'https://maps.cambridge.ca/arcgispub03/rest/services/Voting/FeatureServer/2/query?where=1%3D1&outFields=WARD_ID&outSR=4326&f=geojson',
		wardField: 'WARD_ID'
	}
];

let cached: unknown = null;

export const GET: RequestHandler = async () => {
	if (cached) {
		return json(cached, { headers: { 'Cache-Control': 'public, max-age=86400' } });
	}

	const results = await Promise.allSettled(
		SOURCES.map(({ city, url, wardField }) =>
			fetch(url, { signal: AbortSignal.timeout(8000) })
				.then((r) => r.json())
				// Normalise: add CITY and WARDID_NORM to every feature
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				.then((geojson) => (geojson.features ?? []).map((f: any) => ({
					...f,
					properties: {
						...f.properties,
						CITY: city,
						WARDID_NORM: Number(f.properties?.[wardField] ?? 0)
					}
				})))
		)
	);

	const features = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
	if (!features.length) throw error(502, 'Ward boundary data unavailable');

	cached = { type: 'FeatureCollection', features };

	return json(cached, { headers: { 'Cache-Control': 'public, max-age=86400' } });
};
