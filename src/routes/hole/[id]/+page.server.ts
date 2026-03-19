import { supabase } from "$lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import type { Pothole, PotholePhoto } from "$lib/types";
import { COUNCILLORS, lookupWard, type Councillor } from "$lib/wards";
import { decodeHtmlEntities } from "$lib/escape";
import { getConfirmationThreshold } from "$lib/server/settings";

function getServiceClient() {
  return createClient(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const CCC_URL =
  "https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Corporate_Contact_Centre_Requests/FeatureServer/0/query";
const CCC_RADIUS_M = 200;

export interface CityRepairRequest {
  intersection: string;
  date: string; // ISO date string
}

interface E2eDetailFixture {
  pothole: Pothole;
  councillor: Councillor | null;
  cityRepairRequests: CityRepairRequest[];
  photos: PotholePhoto[];
  confirmationThreshold: number;
  hitCount: number;
  nearbyFilled: { id: string; address: string | null; filled_at: string; created_at: string }[];
}

const E2E_DETAIL_FIXTURES: Record<string, E2eDetailFixture> = {
  "11111111-1111-4111-8111-111111111111": {
    pothole: {
      id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-03-07T12:00:00.000Z",
      lat: 43.4472,
      lng: -80.489,
      address: "700 King Street West",
      description: "Wide crater in the curb lane near the intersection.",
      status: "reported",
      confirmed_count: 3,
      filled_at: null,
      expired_at: null,
      photos_published: false,
    },
    councillor:
      COUNCILLORS.find((c) => c.city === "kitchener" && c.ward === 9) ?? null,
    cityRepairRequests: [
      { intersection: "King St W & Union St W", date: "2026-03-06" },
    ],
    photos: [],
    confirmationThreshold: 2,
    hitCount: 3,
    nearbyFilled: [],
  },
  "22222222-2222-4222-8222-222222222222": {
    pothole: {
      id: "22222222-2222-4222-8222-222222222222",
      created_at: "2026-03-09T09:30:00.000Z",
      lat: 43.4631,
      lng: -80.5204,
      address: "55 Erb Street East",
      description: "Fresh report waiting for another confirmation.",
      status: "pending",
      confirmed_count: 1,
      filled_at: null,
      expired_at: null,
      photos_published: false,
    },
    councillor:
      COUNCILLORS.find((c) => c.city === "waterloo" && c.ward === 6) ?? null,
    cityRepairRequests: [],
    photos: [],
    confirmationThreshold: 2,
    hitCount: 0,
    nearbyFilled: [],
  },
};

async function fetchCityRepairRequests(
  lat: number,
  lng: number,
): Promise<CityRepairRequest[]> {
  const params = new URLSearchParams({
    where: "REQUEST_NAME='Potholes_Hot_Mix_Repairs'",
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: String(CCC_RADIUS_M),
    units: "esriSRUnit_Meter",
    outFields: "INTERSECTION,CREATE_DATE",
    orderByFields: "CREATE_DATE DESC",
    resultRecordCount: "5",
    returnGeometry: "false",
    f: "json",
  });

  try {
    const res = await fetch(`${CCC_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const features: unknown[] = Array.isArray(json.features)
      ? json.features
      : [];
    return features.flatMap((f) => {
      // Validate shape — ArcGIS response may be missing fields if the service
      // returns an unexpected schema version.
      if (
        typeof f !== "object" ||
        f === null ||
        !("attributes" in f) ||
        typeof (f as Record<string, unknown>).attributes !== "object"
      )
        return [];
      const attrs = (f as { attributes: Record<string, unknown> }).attributes;
      const intersection = attrs.INTERSECTION;
      const createDate = attrs.CREATE_DATE;
      if (typeof intersection !== "string" || !intersection) return [];
      if (typeof createDate !== "number") return [];
      const date = new Date(createDate);
      if (isNaN(date.getTime())) return [];
      return [{ intersection, date: date.toISOString().slice(0, 10) }];
    });
  } catch {
    return [];
  }
}

export const load: PageServerLoad = async ({ params, url }) => {
  if (
    process.env.PLAYWRIGHT_E2E_FIXTURES === "true" &&
    url.searchParams.get("__fixture") === "1"
  ) {
    const fixture = E2E_DETAIL_FIXTURES[params.id];
    if (fixture) {
      return { ...fixture, origin: url.origin };
    }
  }

  const { data, error: dbError } = await supabase
    .from("potholes")
    .select(
      "id, created_at, lat, lng, address, description, status, confirmed_count, filled_at, expired_at, photos_published",
    )
    .eq("id", params.id)
    .single();

  if (dbError || !data) {
    throw error(404, "Hole not found");
  }

  const pothole = {
    ...data,
    address: data.address ? decodeHtmlEntities(data.address) : null,
    description: data.description ? decodeHtmlEntities(data.description) : null,
  } as Pothole;
  // Bounding box for proximity queries — ~110m radius
  const delta = 0.001;
  const db = getServiceClient();

  const [councillor, cityRepairRequests, photosResult, confirmationThreshold, hitCountResult, nearbyFilledResult] =
    await Promise.all([
      lookupWard(pothole.lat, pothole.lng),
      fetchCityRepairRequests(pothole.lat, pothole.lng),
      supabase
        .from("pothole_photos")
        .select("id, storage_path, created_at")
        .eq("pothole_id", params.id)
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: true }),
      getConfirmationThreshold(),
      // Hit count via service-role — pothole_hits has no anon SELECT policy
      db
        .from("pothole_hits")
        .select("*", { count: "exact", head: true })
        .eq("pothole_id", params.id),
      // Recently filled potholes nearby — surface repeat road issues
      supabase
        .from("potholes")
        .select("id, address, filled_at, created_at")
        .eq("status", "filled")
        .neq("id", params.id)
        .gte("lat", pothole.lat - delta)
        .lte("lat", pothole.lat + delta)
        .gte("lng", pothole.lng - delta)
        .lte("lng", pothole.lng + delta)
        .not("filled_at", "is", null)
        .order("filled_at", { ascending: false })
        .limit(3),
    ]);

  // Only expose photos publicly when admin has explicitly published them for this pothole.
  // A reported (live) pothole does not imply its photos are visible.
  const photos: PotholePhoto[] = pothole.photos_published
    ? (photosResult.data ?? []).map((p) => ({
        ...p,
        pothole_id: params.id,
        moderation_status: "approved" as const,
        moderation_score: null,
        url: supabase.storage
          .from("pothole-photos")
          .getPublicUrl(p.storage_path).data.publicUrl,
      }))
    : [];

  const hitCount = hitCountResult.count ?? 0;
  const nearbyFilled = (nearbyFilledResult.data ?? []).map((p) => ({
    id: p.id,
    address: p.address ? decodeHtmlEntities(p.address) : null,
    filled_at: p.filled_at as string,
    created_at: p.created_at as string,
  }));

  return {
    pothole,
    councillor,
    cityRepairRequests,
    photos,
    origin: url.origin,
    confirmationThreshold,
    hitCount,
    nearbyFilled,
  };
};
