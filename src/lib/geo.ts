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
