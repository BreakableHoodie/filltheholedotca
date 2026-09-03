/**
 * fillthehole.ca — parked notice worker.
 *
 * Serves a static "paused" page for every route on the zone, and keeps the two
 * open-data endpoints alive from a frozen snapshot so existing consumers and the
 * AGPL data promise don't simply 404 while the app is parked.
 *
 * The SvelteKit app stays deployed on Netlify and untouched. Un-parking is
 * removing this worker's routes from the zone — no redeploy, no DNS change.
 */

const SNAPSHOTS = {
	'/api/export.csv': { asset: '/api/export.csv', type: 'text/csv; charset=utf-8' },
	'/api/feed.json': { asset: '/api/feed.json', type: 'application/json; charset=utf-8' },
};

const ROBOTS = 'User-agent: *\nAllow: /\n';

// The ASSETS binding is addressed by path only. Resolving against the incoming
// request's own origin risks a self-referential subrequest (Cloudflare 1042), so
// pin a fixed synthetic base instead.
const assetUrl = (path) => new URL(path, 'https://assets.local');

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname.replace(/\/+$/, '') || '/';

		if (request.method !== 'GET' && request.method !== 'HEAD') {
			// The report/photo/vote endpoints are gone; say so honestly rather than
			// letting a stale client believe its POST was accepted.
			return new Response('fillthehole.ca is paused and is not accepting submissions.', {
				status: 405,
				headers: { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' },
			});
		}

		if (path === '/robots.txt') {
			return new Response(ROBOTS, {
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			});
		}

		const snapshot = SNAPSHOTS[path];
		if (snapshot) {
			const res = await env.ASSETS.fetch(assetUrl(snapshot.asset));
			// Same reasoning as below — a missing snapshot must not read as an empty
			// but successful dataset to an open-data consumer.
			if (!res.ok) return res;
			return new Response(res.body, {
				status: 200,
				headers: {
					'content-type': snapshot.type,
					'access-control-allow-origin': '*',
					'cache-control': 'public, max-age=3600',
					'x-fillthehole-status': 'parked-snapshot',
				},
			});
		}

		// Everything else — the map, /hole/[id] permalinks, /stats, /admin — gets the notice.
		const page = await env.ASSETS.fetch(assetUrl('/index.html'));
		// Never dress a failed asset fetch up as a successful parked page: a missing
		// index.html would otherwise serve an empty body with a 200.
		if (!page.ok) return page;
		return new Response(page.body, {
			status: 200,
			headers: {
				'content-type': 'text/html; charset=utf-8',
				// This is the parked page's own TTL. Not to be confused with the live app's
				// s-maxage=60 + stale-while-revalidate=300, which is what produces the ~6
				// minute tail at cutover and un-park — purge the zone cache to skip it.
				'cache-control': 'public, max-age=300',
				'x-fillthehole-status': 'parked',
			},
		});
	},
};
