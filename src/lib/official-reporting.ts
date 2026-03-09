import type { City } from "$lib/wards";

export interface OfficialReportLink {
  id: "kitchener" | "waterloo" | "cambridge" | "region" | "mto";
  label: string;
  href: string;
  scope: "city" | "region" | "province";
}

export const CITY_LABELS: Record<City, string> = {
  kitchener: "City of Kitchener",
  waterloo: "City of Waterloo",
  cambridge: "City of Cambridge",
} as const;

export const CITY_REPORT_LINKS: Record<City, OfficialReportLink> = {
  kitchener: {
    id: "kitchener",
    label: CITY_LABELS.kitchener,
    href: "https://www.kitchener.ca/en/transportation-and-parking/report-a-road-concern.aspx",
    scope: "city",
  },
  waterloo: {
    id: "waterloo",
    label: CITY_LABELS.waterloo,
    href: "https://www.waterloo.ca/roads-and-cycling/report-a-road-trail-or-sidewalk-issue/",
    scope: "city",
  },
  cambridge: {
    id: "cambridge",
    label: CITY_LABELS.cambridge,
    href: "https://maps.cambridge.ca/gis/ServiceRequests/Pothole/",
    scope: "city",
  },
} as const;

export const REGION_REPORT_LINK: OfficialReportLink = {
  id: "region",
  label: "Region of Waterloo",
  href: "https://www.regionofwaterloo.ca/en/living-here/roads-and-traffic.aspx",
  scope: "region",
};

export const MTO_REPORT_LINK: OfficialReportLink = {
  id: "mto",
  label: "Ontario Ministry of Transportation",
  href: "https://www.ontario.ca/page/report-problem-provincial-highway",
  scope: "province",
};

export const ABOUT_REPORT_LINKS: readonly OfficialReportLink[] = [
  CITY_REPORT_LINKS.kitchener,
  CITY_REPORT_LINKS.waterloo,
  CITY_REPORT_LINKS.cambridge,
  REGION_REPORT_LINK,
  MTO_REPORT_LINK,
];
