import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';
import { decodeHtmlEntities } from '$lib/escape';
import { PUBLIC_COORD_DECIMALS, roundPublicCoord } from '$lib/geo';

const STATUS_LABEL: Record<string, string> = {
	reported: 'Open — awaiting fix',
	filled: 'Filled ✓',
	pending: 'Awaiting confirmation',
	expired: 'Expired'
};

const STATUS_COLOR: Record<string, string> = {
	reported: '#fb923c', // orange-400
	filled: '#4ade80',   // green-400
	pending: '#71717a',  // zinc-500
	expired: '#52525b'   // zinc-600
};

function escHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function daysBetween(from: string, to: number | string = Date.now()): number {
	return Math.floor((new Date(to as string).getTime() - new Date(from).getTime()) / 86_400_000);
}

/** Embeddable card widget — returns a full self-contained HTML document. */
export const GET: RequestHandler = async ({ params, url }) => {
	const { data } = await supabase
		.from('potholes')
		.select('id, created_at, lat, lng, address, description, status, filled_at')
		.eq('id', params.id)
		.single();

	if (!data) throw error(404, 'Not found');

	const address = data.address
		? escHtml(decodeHtmlEntities(data.address))
		: `${roundPublicCoord(data.lat).toFixed(PUBLIC_COORD_DECIMALS)}, ${roundPublicCoord(data.lng).toFixed(PUBLIC_COORD_DECIMALS)}`;
	const status = data.status as string;
	const statusLabel = escHtml(STATUS_LABEL[status] ?? status);
	const color = STATUS_COLOR[status] ?? '#71717a';
	// For filled potholes show how long it took to fix; for open ones show age.
	const days = data.filled_at
		? daysBetween(data.created_at, data.filled_at)
		: daysBetween(data.created_at);
	const origin = url.origin.replace('/api/embed', '');
	const detailUrl = `${origin.startsWith('http') ? origin : 'https://fillthehole.ca'}/hole/${data.id}`;

	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Pothole — FillTheHole.ca</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#09090b;color:#e4e4e7;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:12px}
.card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:16px;max-width:360px;width:100%}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:${color};margin-bottom:10px}
.dot{width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0}
.address{font-size:15px;font-weight:600;color:#fafafa;line-height:1.3;margin-bottom:6px}
.meta{font-size:12px;color:#71717a;margin-bottom:14px}
.meta span{color:#a1a1aa}
.cta{display:block;text-align:center;background:#0ea5e9;color:#fff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;padding:8px 12px;transition:background .15s}
.cta:hover{background:#0284c7}
.powered{margin-top:10px;text-align:center;font-size:10px;color:#3f3f46}
.powered a{color:#52525b;text-decoration:none}
.powered a:hover{color:#71717a}
</style>
</head>
<body>
<div class="card">
  <div class="badge"><span class="dot"></span>${statusLabel}</div>
  <div class="address">${address}</div>
  <div class="meta">
    ${status === 'filled' ? `Filled after <span>${days}</span> day${days === 1 ? '' : 's'}` : `<span>${days}</span> day${days === 1 ? '' : 's'} open — unfilled`}
  </div>
  <a class="cta" href="${escHtml(detailUrl)}" target="_blank" rel="noopener noreferrer">View on FillTheHole.ca →</a>
  <p class="powered"><a href="https://fillthehole.ca" target="_blank" rel="noopener noreferrer">fillthehole.ca</a> — Waterloo Region pothole tracker</p>
</div>
</body>
</html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			// Allow cross-origin embedding — this endpoint is intentionally public
			'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *",
			'Cache-Control': 'public, max-age=60, s-maxage=300'
		}
	});
};
