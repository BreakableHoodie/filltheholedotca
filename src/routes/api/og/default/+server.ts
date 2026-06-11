import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { logError } from '$lib/server/observability';
import { el } from '$lib/server/og-helpers';

// Static, content-free branded card used as the default Open Graph / Twitter
// image for pages without a per-record image (homepage, about, how-to, etc.).
// CLAUDE.md forbids committing binary assets, so this is generated at request
// time and cached hard rather than shipped as a PNG in the repo. Visual family
// is kept in sync with /api/og/[id] so all share cards look alike.
const require = createRequire(import.meta.url);
const OG_FONT_PATH = require.resolve(
	'@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff'
);

let fontCache: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
	if (fontCache) return fontCache;
	try {
		const fontFile = await readFile(OG_FONT_PATH);
		fontCache = fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength);
		return fontCache;
	} catch (e) {
		// Do not cache failures — next request should retry loading from disk.
		logError('og/default', 'Font load failed', e);
		throw error(500, 'OG image generation unavailable');
	}
}

export const GET: RequestHandler = async () => {
	const font = await loadFont();

	const svg = await satori(
		el(
			'div',
			{
				style: {
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					background: '#09090b',
					padding: '56px 64px',
					fontFamily: 'Barlow Condensed',
					borderLeft: '6px solid #f97316',
				},
			},
			// Header: logo mark + wordmark
			el(
				'div',
				{ style: { display: 'flex', alignItems: 'center', gap: '14px' } },
				el(
					'div',
					{
						style: {
							width: 44,
							height: 44,
							borderRadius: 22,
							background: '#f97316',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						},
					},
					el('div', { style: { width: 27, height: 27, borderRadius: 14, background: '#09090b' } })
				),
				el(
					'div',
					{ style: { display: 'flex', alignItems: 'baseline' } },
					el(
						'span',
						{ style: { fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' } },
						'FillTheHole'
					),
					el('span', { style: { fontSize: 26, fontWeight: 700, color: '#38bdf8' } }, '.ca')
				)
			),
			// Body: headline + tagline
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
				el(
					'div',
					{ style: { fontSize: 74, fontWeight: 700, color: '#fff', lineHeight: 1.05, letterSpacing: '-0.01em' } },
					'Waterloo Region Pothole Tracker'
				),
				el(
					'div',
					{ style: { fontSize: 30, color: '#a1a1aa', letterSpacing: '0.01em' } },
					'Report it. Confirm it. Hold the city accountable.'
				)
			),
			// Footer: region label
			el(
				'div',
				{ style: { display: 'flex', alignItems: 'center', gap: '12px' } },
				el('div', { style: { width: 10, height: 10, borderRadius: 5, background: '#f97316' } }),
				el(
					'div',
					{ style: { fontSize: 24, color: '#71717a', fontWeight: 700, letterSpacing: '0.04em' } },
					'KITCHENER · WATERLOO · CAMBRIDGE'
				)
			)
		),
		{
			width: 1200,
			height: 630,
			fonts: [{ name: 'Barlow Condensed', data: font, weight: 700, style: 'normal' }],
		}
	);

	const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
	const png = new Uint8Array(resvg.render().asPng());

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			// Static content — cache aggressively at the edge.
			'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
			// OG images are embedded by external social crawlers — opt out of the
			// same-site default set in hooks.server.ts.
			'Cross-Origin-Resource-Policy': 'cross-origin',
		},
	});
};
