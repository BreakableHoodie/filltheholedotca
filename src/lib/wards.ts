export type City = 'kitchener' | 'waterloo' | 'cambridge';

export interface Councillor {
	ward:  number;
	city:  City;
	name:  string;
	email: string;
	phone: string;
	url:   string;
}

export const COUNCILLORS: Councillor[] = [
	// ── Kitchener (wards 1–10) ──────────────────────────────────────────────
	{ city: 'kitchener', ward: 1,  name: 'Scott Davey',       email: 'Scott.Davey@kitchener.ca',       phone: '519-741-2784', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-scott-davey/' },
	{ city: 'kitchener', ward: 2,  name: 'Dave Schnider',     email: 'Dave.Schnider@kitchener.ca',     phone: '519-741-3424', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-dave-schnider/' },
	{ city: 'kitchener', ward: 3,  name: 'Jason Deneault',    email: 'Jason.Deneault@kitchener.ca',    phone: '519-741-2790', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-jason-deneault/' },
	{ city: 'kitchener', ward: 4,  name: 'Christine Michaud', email: 'Christine.Michaud@kitchener.ca', phone: '519-741-2779', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-christine-michaud/' },
	{ city: 'kitchener', ward: 5,  name: 'Ayo Owodunni',      email: 'Ayo.Owodunni@kitchener.ca',      phone: '519-741-2791', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-ayo-owodunni/' },
	{ city: 'kitchener', ward: 6,  name: 'Paul Singh',        email: 'Paul.Singh@kitchener.ca',        phone: '519-741-2793', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-paul-singh/' },
	{ city: 'kitchener', ward: 7,  name: 'Bil Ioannidis',     email: 'Bil.Ioannidis@kitchener.ca',     phone: '519-741-2783', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-bil-ioannidis/' },
	{ city: 'kitchener', ward: 8,  name: 'Margaret Johnston', email: 'Margaret.Johnston@kitchener.ca', phone: '519-741-2796', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-margaret-johnston/' },
	{ city: 'kitchener', ward: 9,  name: 'Debbie Chapman',    email: 'Debbie.Chapman@kitchener.ca',    phone: '519-741-2798', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-debbie-chapman/' },
	{ city: 'kitchener', ward: 10, name: 'Stephanie Stretch', email: 'Stephanie.Stretch@kitchener.ca', phone: '519-741-2786', url: 'https://www.kitchener.ca/council-and-city-administration/mayor-and-council/city-council/councillor-stephanie-stretch/' },

	// ── Waterloo (wards 1–7) ────────────────────────────────────────────────
	{ city: 'waterloo', ward: 1, name: 'Sandra Hanmer',  email: 'sandra.hanmer@waterloo.ca',  phone: '519-747-8784', url: 'https://www.waterloo.ca/council-and-committees/mayor-and-city-council/ward-1-councillor/' },
	{ city: 'waterloo', ward: 2, name: 'Royce Bodaly',   email: 'royce.bodaly@waterloo.ca',   phone: '519-747-8784', url: 'https://www.waterloo.ca/council-and-committees/mayor-and-city-council/ward-2-councillor/' },
	{ city: 'waterloo', ward: 3, name: 'Hans Roach',     email: 'hans.roach@waterloo.ca',     phone: '519-747-8784', url: 'https://www.waterloo.ca/council-and-committees/mayor-and-city-council/ward-3-councillor/' },
	{ city: 'waterloo', ward: 4, name: 'Diane Freeman',  email: 'diane.freeman@waterloo.ca',  phone: '519-747-8784', url: 'https://www.waterloo.ca/council-and-committees/mayor-and-city-council/ward-4-councillor/' },
	{ city: 'waterloo', ward: 5, name: 'Jen Vasic',      email: 'jen.vasic@waterloo.ca',      phone: '519-747-8784', url: 'https://www.waterloo.ca/council-and-committees/mayor-and-city-council/ward-5-councillor/' },
	{ city: 'waterloo', ward: 6, name: 'Mary Lou Roe',   email: 'mary.lou.roe@waterloo.ca',   phone: '519-747-8784', url: 'https://www.waterloo.ca/council-and-committees/mayor-and-city-council/ward-6-councillor/' },
	{ city: 'waterloo', ward: 7, name: 'Julie Wright',   email: 'julie.wright@waterloo.ca',   phone: '519-747-8784', url: 'https://www.waterloo.ca/council-and-committees/mayor-and-city-council/ward-7-councillor/' },

	// ── Cambridge (wards 1–8) ───────────────────────────────────────────────
	{ city: 'cambridge', ward: 1, name: 'Helen Shwery',    email: 'shweryh@cambridge.ca',   phone: '519-740-4517 ext. 4741', url: 'https://www.cambridge.ca/en/your-city/councillor-helen-shwery.aspx' },
	{ city: 'cambridge', ward: 2, name: 'Mike Devine',     email: 'devinem@cambridge.ca',   phone: '519-740-4517 ext. 4731', url: 'https://www.cambridge.ca/en/your-city/councillor-mike-devine.aspx' },
	{ city: 'cambridge', ward: 3, name: 'Corey Kimpson',   email: 'kimpsonc@cambridge.ca',  phone: '519-740-4517 ext. 4467', url: 'https://www.cambridge.ca/en/your-city/councillor-kimpson-s-biography.aspx' },
	{ city: 'cambridge', ward: 4, name: 'Ross Earnshaw',   email: 'earnshawr@cambridge.ca', phone: '519-740-4517 ext. 4081', url: 'https://www.cambridge.ca/en/your-city/councillor-earnshaw-s-biography.aspx' },
	{ city: 'cambridge', ward: 5, name: 'Sheri Roberts',   email: 'robertss@cambridge.ca',  phone: '519-740-4517 ext. 4540', url: 'https://www.cambridge.ca/en/your-city/councillor-roberts-biography.aspx' },
	{ city: 'cambridge', ward: 6, name: 'Adam Cooper',     email: 'coopera@cambridge.ca',   phone: '519-740-4517 ext. 4269', url: 'https://www.cambridge.ca/en/your-city/councillor-cooper-s-biography.aspx' },
	{ city: 'cambridge', ward: 7, name: 'Scott Hamilton',  email: 'hamiltons@cambridge.ca', phone: '519-740-4517 ext. 4738', url: 'https://www.cambridge.ca/en/your-city/councillor-hamilton-s-biography.aspx' },
	{ city: 'cambridge', ward: 8, name: 'Nicholas Ermeta', email: 'ermetan@cambridge.ca',   phone: '519-740-4517 ext. 4740', url: 'https://www.cambridge.ca/en/your-city/councillor-nicholas-ermeta.aspx' },
];

// ── Ward boundary sources ────────────────────────────────────────────────────

const WARD_SOURCES: Record<City, { url: string; wardField: string }> = {
	kitchener: {
		url: 'https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Wards/FeatureServer/0/query?where=1%3D1&outFields=WARDID&outSR=4326&f=geojson',
		wardField: 'WARDID'
	},
	waterloo: {
		url: 'https://services.arcgis.com/ZpeBVw5o1kjit7LT/arcgis/rest/services/Wards2022/FeatureServer/0/query?where=1%3D1&outFields=WARD_NO&outSR=4326&f=geojson',
		wardField: 'WARD_NO'
	},
	cambridge: {
		url: 'https://maps.cambridge.ca/arcgispub03/rest/services/Voting/FeatureServer/2/query?where=1%3D1&outFields=WARD_ID&outSR=4326&f=geojson',
		wardField: 'WARD_ID'
	}
};

// ── Per-city GeoJSON cache ────────────────────────────────────────────────────

interface GeoJSONFeature {
	type: string;
	properties: Record<string, unknown>;
	geometry: {
		type: string;
		coordinates: number[][][] | number[][][][];
	};
}

const wardCache: Partial<Record<City, GeoJSONFeature[]>> = {};

// ── Geometry helpers ──────────────────────────────────────────────────────────

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

function pointInPolygon(lng: number, lat: number, geometry: GeoJSONFeature['geometry']): boolean {
	if (geometry.type === 'Polygon') {
		return pointInRing(lng, lat, (geometry.coordinates as number[][][])[0]);
	}
	if (geometry.type === 'MultiPolygon') {
		return (geometry.coordinates as number[][][][]).some((poly) => pointInRing(lng, lat, poly[0]));
	}
	return false;
}

// ── Ward lookup ───────────────────────────────────────────────────────────────

async function fetchWards(city: City): Promise<GeoJSONFeature[]> {
	if (wardCache[city]) return wardCache[city]!;
	const { url } = WARD_SOURCES[city];
	const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
	if (!res.ok) return [];
	const geojson = await res.json();
	wardCache[city] = geojson.features ?? [];
	return wardCache[city]!;
}

export async function lookupWard(lat: number, lng: number): Promise<Councillor | null> {
	try {
		// Fetch all three cities in parallel
		const [kitchenerFeatures, waterlooFeatures, cambridgeFeatures] = await Promise.all([
			fetchWards('kitchener'),
			fetchWards('waterloo'),
			fetchWards('cambridge')
		]);

		const sources: [City, GeoJSONFeature[]][] = [
			['kitchener', kitchenerFeatures],
			['waterloo',  waterlooFeatures],
			['cambridge', cambridgeFeatures]
		];

		for (const [city, features] of sources) {
			const { wardField } = WARD_SOURCES[city];
			for (const feature of features) {
				if (pointInPolygon(lng, lat, feature.geometry)) {
					const wardNum = Number(feature.properties[wardField]);
					const councillor = COUNCILLORS.find((c) => c.city === city && c.ward === wardNum);
					if (councillor) return councillor;
				}
			}
		}
	} catch {
		// Network error or timeout — silently fail
	}
	return null;
}
