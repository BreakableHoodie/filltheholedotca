import { supabase } from "$lib/supabase";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import type { Pothole, PotholePhoto } from "$lib/types";
import { COUNCILLORS, lookupWard, type Councillor } from "$lib/wards";
import { decodeHtmlEntities } from "$lib/escape";
import { getConfirmationThreshold } from "$lib/server/settings";
import { haversineMetres } from "$lib/geo";
import { logError } from "$lib/server/observability";
import { getAdminClient } from "$lib/server/supabase";

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
  // Fixture with nearbyFilled data — exercises the recurring-road-issue banner
  "33333333-3333-4333-8333-333333333333": {
    pothole: {
      id: "33333333-3333-4333-8333-333333333333",
      created_at: "2026-03-15T10:00:00.000Z",
      lat: 43.4500,
      lng: -80.5000,
      address: "200 Queen Street North",
      description: "Deep crack across the full lane width.",
      status: "reported",
      confirmed_count: 2,
      filled_at: null,
      expired_at: null,
      photos_published: false,
    },
    councillor: null,
    cityRepairRequests: [],
    photos: [],
    confirmationThreshold: 2,
    hitCount: 1,
    nearbyFilled: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        address: "198 Queen Street North",
        filled_at: "2025-11-01T12:00:00.000Z",
        created_at: "2025-10-15T09:00:00.000Z",
      },
    ],
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
  } catch (err) {
    // Detail page still renders if the Region's ArcGIS service is unreachable —
    // just surface the failure so we notice chronic outages. Coordinates are
    // intentionally omitted: this PR's whole point is keeping precise reporter
    // locations out of third-party telemetry, and ArcGIS outages are regional.
    logError("hole/ccc", "fetchCityRepairRequests failed", err);
    return [];
  }
}

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
  if (
    process.env.PLAYWRIGHT_E2E_FIXTURES === "true" &&
    url.searchParams.get("__fixture") === "1"
  ) {
    const fixture = E2E_DETAIL_FIXTURES[params.id];
    if (fixture) {
      return { ...fixture, origin: url.origin };
    }
  }

  setHeaders({ "Cache-Control": "public, max-age=300, stale-while-revalidate=600" });

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
  const db = getAdminClient();

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
      // Recently filled potholes nearby — surface repeat road issues.
      // Fetch more rows than needed so haversine post-filter has enough candidates.
      db
        .from("potholes")
        .select("id, address, lat, lng, filled_at, created_at")
        .eq("status", "filled")
        .neq("id", params.id)
        .gte("lat", pothole.lat - delta)
        .lte("lat", pothole.lat + delta)
        .gte("lng", pothole.lng - delta)
        .lte("lng", pothole.lng + delta)
        .not("filled_at", "is", null)
        .order("filled_at", { ascending: false })
        .limit(10),
    ]);

  // Only expose photos publicly when admin has explicitly published them for this pothole.
  // A reported (live) pothole does not imply its photos are visible.
  const photos: PotholePhoto[] = pothole.photos_published
    ? (photosResult.data ?? []).map((p) => {
        const storage = supabase.storage.from("pothole-photos");
        return {
          ...p,
          pothole_id: params.id,
          moderation_status: "approved" as const,
          moderation_score: null,
          url: storage.getPublicUrl(p.storage_path).data.publicUrl,
          // Supabase Image Transformation (Pro feature): serve an 800px-wide
          // resized image for the thumbnail strip. The img onerror handler falls
          // back to url if transformation is unavailable.
          thumbnailUrl: storage.getPublicUrl(p.storage_path, {
            transform: { width: 800, quality: 80, resize: 'contain' }
          }).data.publicUrl,
        };
      })
    : [];

  const hitCount = hitCountResult.count ?? 0;
  const nearbyFilled = (nearbyFilledResult.data ?? [])
    .filter((p) => haversineMetres(pothole.lat, pothole.lng, p.lat, p.lng) <= 110)
    .slice(0, 3)
    .map((p) => ({
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
