import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { decodeHtmlEntities } from '$lib/escape';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const paramsSchema = z.object({ id: z.string().uuid() });
const require = createRequire(import.meta.url);
const OG_FONT_PATH = require.resolve(
	'@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff'
);

// Cache font at module level — reused across warm Lambda invocations
let fontCache: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
	if (fontCache) return fontCache;
	try {
		const fontFile = await readFile(OG_FONT_PATH);
		fontCache = fontFile.buffer.slice(
			fontFile.byteOffset,
			fontFile.byteOffset + fontFile.byteLength
		);
		return fontCache;
	} catch (e) {
		// Do not cache failures — next request should retry loading from disk.
		console.error('[og] Font load failed:', e);
		throw error(500, 'OG image generation unavailable');
	}
}

// Lightweight satori element helper — avoids React dependency.
// props intentionally typed as any: satori's CSS style values are mixed types
// and the return must satisfy satori's internal ReactNode-compatible signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function el(type: string, props: Record<string, any>, ...children: any[]): any {
	return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}

// Colours kept in sync with STATUS_CONFIG hex values in src/lib/constants.ts
const STATUS_STYLES = {
	reported: { label: 'Unfilled', dot: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
	filled:   { label: 'Filled',   dot: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)'  },
	pending:  { label: 'Pending',  dot: '#a1a1aa', bg: 'rgba(161,161,170,0.12)', border: 'rgba(161,161,170,0.3)' },
	expired:  { label: 'Expired',  dot: '#71717a', bg: 'rgba(113,113,122,0.12)', border: 'rgba(113,113,122,0.3)' },
} as const;

export const GET: RequestHandler = async ({ params }) => {
	const parsed = paramsSchema.safeParse(params);
	if (!parsed.success) throw error(400, 'Invalid ID');

	const { data: pothole, error: dbError } = await supabase
		.from('potholes')
		.select('id, address, lat, lng, status, created_at, filled_at')
		.eq('id', parsed.data.id)
		.single();

	if (dbError && dbError.code !== 'PGRST116') throw error(500, 'Database error');
	if (!pothole) throw error(404, 'Hole not found');

	const font = await loadFont();

	const address = pothole.address ? decodeHtmlEntities(pothole.address) : null;
	const rawAddress = address
		? address.length > 55
			? address.slice(0, 54) + '…'
			: address
		: `${(pothole.lat as number).toFixed(4)}, ${(pothole.lng as number).toFixed(4)}`;

	// Shrink font size for longer addresses so they always fit on two lines
	const addrLen = rawAddress.length;
	const fontSize = addrLen <= 28 ? 68 : addrLen <= 42 ? 54 : 42;

	const st = STATUS_STYLES[pothole.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.reported;

	const reportedMs = Date.now() - new Date(pothole.created_at as string).getTime();
	const reportedDays = Math.floor(reportedMs / 86_400_000);
	const daysToFill = pothole.filled_at
		? Math.floor(
				(new Date(pothole.filled_at as string).getTime() -
					new Date(pothole.created_at as string).getTime()) /
					86_400_000
			)
		: null;

	const daysLabel =
		pothole.status === 'filled' && daysToFill !== null
			? daysToFill === 0
				? 'Filled same day'
				: `Filled in ${daysToFill} day${daysToFill === 1 ? '' : 's'}`
			: reportedDays === 0
				? 'Reported today'
				: `${reportedDays} day${reportedDays === 1 ? '' : 's'} unfilled`;

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
					el('div', {
						style: { width: 27, height: 27, borderRadius: 14, background: '#09090b' },
					})
				),
				el(
					'div',
					{ style: { display: 'flex', alignItems: 'baseline' } },
					el(
						'span',
						{ style: { fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' } },
						'FillTheHole'
					),
					el(
						'span',
						{ style: { fontSize: 26, fontWeight: 700, color: '#38bdf8' } },
						'.ca'
					)
				)
			),
			// Body: address + region
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
				el(
					'div',
					{
						style: {
							fontSize,
							fontWeight: 700,
							color: '#fff',
							lineHeight: 1.1,
							letterSpacing: '-0.01em',
						},
					},
					rawAddress
				),
				el(
					'div',
					{ style: { fontSize: 24, color: '#71717a', letterSpacing: '0.02em' } },
					'Waterloo Region, Ontario'
				)
			),
			// Footer: status badge + days label
			el(
				'div',
				{ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
				el(
					'div',
					{
						style: {
							display: 'flex',
							alignItems: 'center',
							gap: '10px',
							padding: '10px 22px',
							borderRadius: 100,
							background: st.bg,
							border: `1.5px solid ${st.border}`,
						},
					},
					el('div', {
						style: { width: 10, height: 10, borderRadius: 5, background: st.dot },
					}),
					el(
						'span',
						{
							style: {
								fontSize: 22,
								fontWeight: 700,
								color: st.dot,
								letterSpacing: '0.04em',
							},
						},
						st.label
					)
				),
				el(
					'div',
					{ style: { fontSize: 24, color: '#71717a', fontWeight: 700 } },
					daysLabel
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
			'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600',
		},
	});
};
