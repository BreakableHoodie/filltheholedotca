/**
 * Privacy precision for stored and published coordinates. 4 decimals ≈ 11m at
 * Waterloo's latitude — enough to locate a block, not a house. Applied at
 * write time in api/report and again at serialisation in every public
 * endpoint (feeds, exports, embeds, OG) as defence in depth.
 */
export const PUBLIC_COORD_DECIMALS = 4;

export function roundPublicCoord(n: number): number {
	const factor = 10 ** PUBLIC_COORD_DECIMALS;
	return Math.round(n * factor) / factor;
}

/**
 * Haversine distance between two lat/lng points, in metres.
 */
export function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6_371_000;
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lng2 - lng1) * Math.PI) / 180;
	const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Point-in-polygon (ray-casting) for a single ring of [lng, lat] coordinates.
 */
export function pipRing(lng: number, lat: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i], [xj, yj] = ring[j];
		if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
}

type PolygonGeometry = { type: 'Polygon'; coordinates: number[][][] };
type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: number[][][][] };
type WardGeometry = PolygonGeometry | MultiPolygonGeometry | { type: string };

/**
 * Returns true if the point (lng, lat) falls within a GeoJSON Polygon or
 * MultiPolygon geometry.
 */
export function inWardFeature(lng: number, lat: number, geometry: WardGeometry): boolean {
	if (geometry.type === 'Polygon') return pipRing(lng, lat, (geometry as PolygonGeometry).coordinates[0]);
	if (geometry.type === 'MultiPolygon')
		return (geometry as MultiPolygonGeometry).coordinates.some((p) => pipRing(lng, lat, p[0]));
	return false;
}
