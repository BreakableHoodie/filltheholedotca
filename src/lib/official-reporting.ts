import type { City } from '$lib/wards';

export interface OfficialReportLink {
	id: 'kitchener' | 'waterloo' | 'cambridge' | 'region' | 'mto';
	label: string;
	href: string;
	scope: 'city' | 'region' | 'province';
}

export const CITY_LABELS: Record<City, string> = {
	kitchener: 'City of Kitchener',
	waterloo: 'City of Waterloo',
	cambridge: 'City of Cambridge',
} as const;

export const CITY_REPORT_LINKS: Record<City, OfficialReportLink> = {
	kitchener: {
		id: 'kitchener',
		label: CITY_LABELS.kitchener,
		href: 'https://form.kitchener.ca/CSD/CCS/Report-a-problem',
		scope: 'city',
	},
	waterloo: {
		id: 'waterloo',
		label: CITY_LABELS.waterloo,
		href: 'https://www.waterloo.ca/roads-and-cycling/report-a-road-trail-or-sidewalk-issue/',
		scope: 'city',
	},
	cambridge: {
		id: 'cambridge',
		label: CITY_LABELS.cambridge,
		href: 'https://maps.cambridge.ca/gis/ServiceRequests/Pothole/',
		scope: 'city',
	},
} as const;

// NOTE: these URLs are asserted verbatim in tests/e2e/pothole-detail.spec.ts. Both of
// them silently 404'd in production for some time because the test pinned the dead
// values and kept passing. If you change one, change it there too — and re-check that
// the destination still matches the scope copy rendered in about/+page.svelte.

export const REGION_REPORT_LINK: OfficialReportLink = {
	id: 'region',
	label: 'Region of Waterloo',
	// scope 'region' renders as "Submit a claim for damages", so this must stay a CLAIMS
	// page, not a reporting page. The Region moved /en/regional-government/*.aspx to
	// /government-and-council/; the old path now 404s.
	href: 'https://www.regionofwaterloo.ca/government-and-council/contact-us/submit-a-claim/',
	scope: 'region',
};

export const MTO_REPORT_LINK: OfficialReportLink = {
	id: 'mto',
	label: 'Ontario Ministry of Transportation',
	// ontario.ca/page/report-problem-provincial-highway is gone. Ontario 511 is MTO's own
	// intake for highway condition problems, which matches the "Report a provincial
	// highway problem" copy. Deliberately NOT ontario.ca/page/submit-claim-damaged-vehicle
	// — that is compensation, not reporting.
	href: 'https://511on.ca/contact',
	scope: 'province',
};

export const ABOUT_REPORT_LINKS: readonly OfficialReportLink[] = [
	CITY_REPORT_LINKS.kitchener,
	CITY_REPORT_LINKS.waterloo,
	CITY_REPORT_LINKS.cambridge,
	REGION_REPORT_LINK,
	MTO_REPORT_LINK,
];
