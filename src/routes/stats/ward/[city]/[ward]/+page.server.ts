import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { decodeHtmlEntities } from '$lib/escape';
import { COUNCILLORS, fetchWards, type GeoJSONFeature } from '$lib/wards';
import { inWardFeature } from '$lib/geo';
import type { PageServerLoad } from './$types';
import type { Pothole } from '$lib/types';
import type { City } from '$lib/wards';

const VALID_CITIES = new Set<string>(['kitchener', 'waterloo', 'cambridge']);

// Ward field name per city — must match WARD_SOURCES in wards.ts
const WARD_FIELD: Record<City, string> = {
  kitchener: 'WARDID',
  waterloo:  'WARD_NO',
  cambridge: 'WARD_ID',
};

export const load: PageServerLoad = async ({ params, url }) => {
  const city = params.city;
  const wardNum = parseInt(params.ward, 10);

  // E2E fixture — returns static data to avoid network/DB calls in tests
  if (
    process.env.PLAYWRIGHT_E2E_FIXTURES === 'true' &&
    url.searchParams.get('__fixture') === '1'
  ) {
    if (city === 'kitchener' && wardNum === 9) {
      const councillor = COUNCILLORS.find(c => c.city === 'kitchener' && c.ward === 9)!;
      return {
        councillor,
        wardPotholes: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            created_at: '2026-01-15T10:00:00.000Z',
            lat: 43.447, lng: -80.489,
            address: 'Weber St E',
            status: 'reported',
            confirmed_count: 3,
            filled_at: null, expired_at: null, photos_published: false,
          },
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            created_at: '2025-11-01T10:00:00.000Z',
            lat: 43.448, lng: -80.490,
            address: 'King St E',
            status: 'filled',
            confirmed_count: 2,
            filled_at: '2025-12-01T10:00:00.000Z', expired_at: null, photos_published: false,
          },
        ] as Pothole[],
        city: 'kitchener' as City,
        ward: 9,
        origin: url.origin,
      };
    }
  }

  // 1. Validate params
  if (!VALID_CITIES.has(city) || isNaN(wardNum) || wardNum < 1) {
    throw error(404, 'Ward not found');
  }

  const councillor = COUNCILLORS.find(
    (c) => c.city === (city as City) && c.ward === wardNum
  );
  if (!councillor) throw error(404, 'Ward not found');

  // 2. Fetch ward boundary
  const features = await fetchWards(city as City);
  const wardField = WARD_FIELD[city as City];
  const wardFeature = features.find(
    (f: GeoJSONFeature) => Number(f.properties[wardField]) === wardNum
  );
  if (!wardFeature) {
    throw error(503, 'Ward boundary data unavailable');
  }

  // 3. Fetch all non-pending potholes
  const { data, error: dbError } = await supabase
    .from('potholes')
    .select('id, created_at, lat, lng, status, filled_at, expired_at, address, confirmed_count')
    .neq('status', 'pending')
    .order('created_at', { ascending: false });

  if (dbError) {
    console.error('[ward page] supabase error:', dbError.message);
    throw error(503, 'Pothole data temporarily unavailable');
  }

  // 4. Filter to ward and decode HTML entities in addresses
  const wardPotholes = (data ?? [])
    .filter((p) => inWardFeature(p.lng, p.lat, wardFeature.geometry))
    .map((p) => ({
      ...p,
      address: p.address ? decodeHtmlEntities(p.address) : null,
    })) as Pothole[];

  return {
    councillor,
    wardPotholes,
    city: city as City,
    ward: wardNum,
    origin: url.origin,
  };
};
