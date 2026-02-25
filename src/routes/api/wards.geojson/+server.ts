import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type SourceConfig = {
	city: 'kitchener' | 'waterloo' | 'cambridge';
	url: string;
	wardField: 'WARDID' | 'WARD_NO' | 'WARD_ID';
};

type NormalizedFeature = {
	type: 'Feature';
	geometry: {
		type: 'Polygon' | 'MultiPolygon';
		coordinates: number[][][] | number[][][][];
	};
	properties: {
		CITY: SourceConfig['city'];
		WARDID_NORM: number;
	};
};

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
] satisfies SourceConfig[];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_CONTROL = 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800';
const ALLOWED_SOURCE_HOSTS = new Set(['services1.arcgis.com', 'services.arcgis.com', 'maps.cambridge.ca']);
let cached: { data: { type: 'FeatureCollection'; features: NormalizedFeature[] }; expiresAt: number } | null = null;

function isFiniteNumber(v: unknown): v is number {
	return typeof v === 'number' && Number.isFinite(v);
}

function isPosition(v: unknown): v is number[] {
	return Array.isArray(v) && v.length >= 2 && v.every(isFiniteNumber);
}

function isLinearRing(v: unknown): v is number[][] {
	return Array.isArray(v) && v.length >= 4 && v.every(isPosition);
}

function isPolygonCoords(v: unknown): v is number[][][] {
	return Array.isArray(v) && v.length > 0 && v.every(isLinearRing);
}

function isMultiPolygonCoords(v: unknown): v is number[][][][] {
	return Array.isArray(v) && v.length > 0 && v.every(isPolygonCoords);
}

function normalizeFeature(
	city: SourceConfig['city'],
	wardField: SourceConfig['wardField'],
	feature: unknown
): NormalizedFeature | null {
	if (!feature || typeof feature !== 'object') return null;
	const raw = feature as { type?: unknown; geometry?: unknown; properties?: Record<string, unknown> };
	if (raw.type !== 'Feature' || !raw.geometry || typeof raw.geometry !== 'object') return null;

	const geometry = raw.geometry as { type?: unknown; coordinates?: unknown };
	let normalizedGeometry: NormalizedFeature['geometry'] | null = null;
	if (geometry.type === 'Polygon' && isPolygonCoords(geometry.coordinates)) {
		normalizedGeometry = { type: 'Polygon', coordinates: geometry.coordinates };
	}
	if (geometry.type === 'MultiPolygon' && isMultiPolygonCoords(geometry.coordinates)) {
		normalizedGeometry = { type: 'MultiPolygon', coordinates: geometry.coordinates };
	}
	if (!normalizedGeometry) return null;

	const wardIdRaw = Number(raw.properties?.[wardField]);
	if (!Number.isFinite(wardIdRaw) || wardIdRaw <= 0) return null;

	return {
		type: 'Feature',
		geometry: normalizedGeometry,
		properties: {
			CITY: city,
			WARDID_NORM: Math.trunc(wardIdRaw)
		}
	};
}

async function fetchWardSource({ city, url, wardField }: SourceConfig): Promise<NormalizedFeature[]> {
	const sourceUrl = new URL(url);
	if (!ALLOWED_SOURCE_HOSTS.has(sourceUrl.hostname)) {
		throw new Error(`Unexpected ward source host: ${sourceUrl.hostname}`);
	}

	const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
	if (!res.ok) {
		throw new Error(`Ward source ${city} failed: HTTP ${res.status}`);
	}

	const payload = (await res.json()) as { features?: unknown[] };
	const features = Array.isArray(payload.features) ? payload.features : [];
	return features
		.map((feature) => normalizeFeature(city, wardField, feature))
		.filter((feature): feature is NormalizedFeature => feature !== null);
}

export const GET: RequestHandler = async () => {
	if (cached && Date.now() < cached.expiresAt) {
		return json(cached.data, { headers: { 'Cache-Control': CACHE_CONTROL } });
	}

	const results = await Promise.allSettled(SOURCES.map((source) => fetchWardSource(source)));

	const features = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
	if (!features.length) {
		if (cached) {
			// Serve stale data on total upstream failure if we have any.
			return json(cached.data, { headers: { 'Cache-Control': CACHE_CONTROL } });
		}
		throw error(502, 'Ward boundary data unavailable');
	}

	cached = { data: { type: 'FeatureCollection', features }, expiresAt: Date.now() + CACHE_TTL_MS };

	return json(cached.data, { headers: { 'Cache-Control': CACHE_CONTROL } });
};
