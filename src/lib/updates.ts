// Public changelog shown on /updates. Keep entries resident-facing — describe
// the user-visible improvement, not the implementation. Newest first.

export interface UpdateEntry {
	/** ISO date (YYYY-MM-DD) — used for the <time> element and ordering. */
	date: string;
	title: string;
	items: string[];
}

export const UPDATES: UpdateEntry[] = [
	{
		date: '2026-06-11',
		title: 'Pothole season, visualized',
		items: [
			'The stats page now overlays freeze–thaw cycles — the winter weather pattern that actually creates potholes — so you can see reports rise and fall with the thaw.'
		]
	},
	{
		date: '2026-06-11',
		title: 'Faster, more private, more accessible',
		items: [
			'The map loads faster, with lighter ward boundaries and a quicker startup.',
			'Stronger privacy: reports that have not yet been confirmed by a second person are no longer publicly listable.',
			'Accessibility pass — better colour contrast, visible keyboard focus, and improved screen-reader support across the site.',
			'Link previews (the cards shown when you share a pothole on social media) work again, and sharing is more reliable.',
			'Clearer instructions on the how-to page, and better search-engine and feed discoverability.'
		]
	},
	{
		date: '2026-06-09',
		title: 'A fresh look',
		items: [
			'A new civic-data-portal design in warm stone and amber, with automatic dark mode that follows your device.'
		]
	}
];
