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

/**
 * Returns true if the point (lng, lat) falls within a GeoJSON Polygon or
 * MultiPolygon geometry.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function inWardFeature(lng: number, lat: number, geometry: any): boolean {
	if (geometry.type === 'Polygon') return pipRing(lng, lat, geometry.coordinates[0]);
	if (geometry.type === 'MultiPolygon')
		return geometry.coordinates.some((p: number[][][]) => pipRing(lng, lat, p[0]));
	return false;
}
