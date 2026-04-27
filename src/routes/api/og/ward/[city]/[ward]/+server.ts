import { error } from '@sveltejs/kit';
import { COUNCILLORS, fetchWards, type GeoJSONFeature } from '$lib/wards';
import { supabase } from '$lib/supabase';
import { inWardFeature } from '$lib/geo';
import { wardGrade } from '$lib/ward-grade';
import { logError } from '$lib/server/observability';
import { el } from '$lib/server/og-helpers';
import type { RequestHandler } from './$types';
import type { City } from '$lib/wards';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

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
    logError('og/ward', 'Font load failed', e);
    throw error(500, 'OG image generation unavailable');
  }
}

const VALID_CITIES = new Set<string>(['kitchener', 'waterloo', 'cambridge']);
const WARD_FIELD: Record<City, string> = {
  kitchener: 'WARDID',
  waterloo:  'WARD_NO',
  cambridge: 'WARD_ID',
};

export const GET: RequestHandler = async ({ params }) => {
  const city = params.city;
  const wardNum = parseInt(params.ward, 10);
  if (!VALID_CITIES.has(city) || isNaN(wardNum) || wardNum < 1) {
    throw error(404, 'Ward not found');
  }

  const councillor = COUNCILLORS.find(
    (c) => c.city === (city as City) && c.ward === wardNum
  );
  if (!councillor) throw error(404, 'Ward not found');

  const features = await fetchWards(city as City);
  const wardFeature = features.find(
    (f: GeoJSONFeature) => Number(f.properties[WARD_FIELD[city as City]]) === wardNum
  );
  if (!wardFeature) throw error(503, 'Ward boundary data unavailable');

  const { data, error: dbError } = await supabase
    .from('potholes')
    .select('lat, lng, status, filled_at, created_at')
    .neq('status', 'pending');

  // Previously destructured `data` without checking `error`. On a DB failure
  // the card would render as "0 potholes · No data yet · A+" — a factually
  // wrong accountability signal spread via social previews. Refuse to
  // generate and let the OG fallback take over. In E2E fixtures mode the
  // stub Supabase always errors, so treat it as "no data" to exercise the
  // rendering pipeline without asserting on real numbers.
  if (dbError && process.env.PLAYWRIGHT_E2E_FIXTURES !== 'true') {
    logError('og/ward', 'potholes query failed', dbError, { city, ward: wardNum });
    throw error(503, 'Ward stats unavailable');
  }

  const wardPotholes = (data ?? []).filter(
    (p) => inWardFeature(p.lng, p.lat, wardFeature.geometry)
  );

  const total = wardPotholes.length;
  const filled = wardPotholes.filter((p) => p.status === 'filled').length;
  const fillRate = total === 0 ? null : (filled / total) * 100;
  const done = wardPotholes.filter((p) => p.status === 'filled' && p.filled_at);
  const avgDays = done.length === 0 ? null :
    done.reduce((s, p) => s + new Date(p.filled_at!).getTime() - new Date(p.created_at).getTime(), 0)
    / done.length / 86_400_000;

  const { grade, color } = wardGrade(fillRate ?? 0, avgDays, total);

  // colour: convert Tailwind class to hex for Satori (can't use Tailwind classes)
  const GRADE_HEX: Record<string, string> = {
    'text-green-400':  '#4ade80',
    'text-sky-400':    '#38bdf8',
    'text-yellow-400': '#facc15',
    'text-orange-400': '#fb923c',
    'text-red-400':    '#f87171',
    'text-zinc-600':   '#52525b',
  };
  const gradeHex = GRADE_HEX[color] ?? '#52525b';

  const cityLabel = city.charAt(0).toUpperCase() + city.slice(1);
  const fillLabel = fillRate !== null ? `${fillRate.toFixed(0)}% fill rate` : 'No data yet';

  const font = await loadFont();

  const svg = await satori(
    el('div', {
      style: {
        width: 1200, height: 630,
        background: '#09090b',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'flex-start',
        padding: '72px 80px',
        fontFamily: 'Barlow Condensed',
      }
    },
      el('div', { style: { fontSize: 28, color: '#71717a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 } },
        `${cityLabel} · Ward ${wardNum}`
      ),
      el('div', { style: { fontSize: 72, color: '#ffffff', fontWeight: 700, lineHeight: 1, marginBottom: 24 } },
        councillor.name
      ),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: 40, marginBottom: 40 } },
        el('div', { style: { fontSize: 120, fontWeight: 700, color: gradeHex, lineHeight: 1 } }, grade),
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          el('div', { style: { fontSize: 32, color: '#e4e4e7', fontWeight: 700 } }, fillLabel),
          el('div', { style: { fontSize: 28, color: '#71717a' } }, 'Ward accountability grade'),
        )
      ),
      el('div', { style: { fontSize: 28, color: '#38bdf8', letterSpacing: '0.04em' } }, 'fillthehole.ca')
    ),
    {
      width: 1200, height: 630,
      fonts: [{ name: 'Barlow Condensed', data: font, weight: 700, style: 'normal' }],
    }
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = new Uint8Array(resvg.render().asPng());

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600',
      // L8: OG images are embedded by external sites — opt out of same-site CORP
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
};
