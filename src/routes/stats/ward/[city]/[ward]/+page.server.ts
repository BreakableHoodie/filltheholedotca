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
  // 1. Validate params
  const city = params.city;
  const wardNum = parseInt(params.ward, 10);
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
