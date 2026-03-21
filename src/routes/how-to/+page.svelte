<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
</script>

<svelte:head>
	<title>How to use — FillTheHole.ca</title>
	<meta name="description" content="Learn how to report potholes, confirm others, track fixes, and get the most out of FillTheHole.ca." />
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-12 space-y-10">
	<div>
		<h1 class="page-title text-4xl sm:text-5xl text-white mb-2">How to use</h1>
		<p class="page-intro text-zinc-400 text-lg">Everything you can do on FillTheHole.ca.</p>
	</div>

	<!-- Reading the map -->
	<section class="space-y-4">
		<h2 class="section-title text-xl text-white flex items-center gap-2">
			<Icon name="map" size={18} class="text-sky-400 shrink-0" />
			Reading the map
		</h2>
		<div class="space-y-3 text-sm text-zinc-400 leading-relaxed">
			<p>
				The map shows every active pothole in Waterloo Region. Pins are colour-coded by status:
			</p>
			<div class="grid gap-2">
				<div class="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
					<span class="w-3 h-3 rounded-full bg-orange-500 shrink-0"></span>
					<span><strong class="text-zinc-200">Orange</strong> — reported and confirmed, waiting for the city to fix it</span>
				</div>
				<div class="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
					<span class="w-3 h-3 rounded-full bg-green-500 shrink-0"></span>
					<span><strong class="text-zinc-200">Green</strong> — filled! The city patched it</span>
				</div>
				<div class="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
					<span class="w-3 h-3 rounded-full bg-zinc-500 shrink-0"></span>
					<span><strong class="text-zinc-200">Grey</strong> — expired after 90 days with no fill event</span>
				</div>
			</div>
			<p>
				When many potholes are close together, they cluster into a numbered circle. Zoom in or tap
				the cluster to expand it and see individual pins.
			</p>
			<p>
				Toggle the <strong class="text-zinc-200">ward heatmap</strong> from the map controls to see
				pothole density by ward. Hover a ward to see the councillor's name and the active hole count.
			</p>
		</div>
	</section>

	<!-- Reporting -->
	<section class="space-y-4">
		<h2 class="section-title text-xl text-white flex items-center gap-2">
			<Icon name="map-pin" size={18} class="text-orange-400 shrink-0" />
			Reporting a pothole
		</h2>

		<div class="flex gap-3 bg-amber-950/40 border border-amber-700/40 rounded-xl p-4 text-sm text-amber-200/90">
			<Icon name="alert-triangle" size={18} class="text-amber-400 shrink-0 mt-0.5" />
			<p>
				<strong class="text-amber-300">Stay safe.</strong>
				Never stop in traffic or step onto a road to report. Report from the sidewalk or parking lot,
				or let a passenger report while you drive. No pothole is worth an injury.
			</p>
		</div>

		<div class="space-y-3 text-sm text-zinc-400 leading-relaxed">
			<p>Tap <strong class="text-zinc-200">Report a pothole</strong> in the top-right corner.</p>
			<ol class="space-y-3 list-none">
				<li class="flex gap-3">
					<span class="shrink-0 w-6 h-6 rounded-full bg-sky-700 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
					<span><strong class="text-zinc-200">Lock your location.</strong> Tap the crosshair icon to use your device's GPS, or search by address and drop a pin manually.</span>
				</li>
				<li class="flex gap-3">
					<span class="shrink-0 w-6 h-6 rounded-full bg-sky-700 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
					<span><strong class="text-zinc-200">Pick severity</strong> (optional). Minor, Moderate, Severe, or Hazardous. This helps prioritise which holes need attention first.</span>
				</li>
				<li class="flex gap-3">
					<span class="shrink-0 w-6 h-6 rounded-full bg-sky-700 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
					<span><strong class="text-zinc-200">Attach a photo</strong> (optional). Photos are compressed automatically. They go through moderation before appearing publicly.</span>
				</li>
				<li class="flex gap-3">
					<span class="shrink-0 w-6 h-6 rounded-full bg-sky-700 text-white text-xs font-bold flex items-center justify-center mt-0.5">4</span>
					<span><strong class="text-zinc-200">Submit.</strong> Your report is logged immediately. It needs one more independent confirmation from a different location before it shows up on the public map.</span>
				</li>
			</ol>
		</div>
	</section>

	<!-- Confirming -->
	<section class="space-y-4">
		<h2 class="section-title text-xl text-white flex items-center gap-2">
			<Icon name="check-circle" size={18} class="text-sky-400 shrink-0" />
			Confirming others' reports
		</h2>
		<p class="text-sm text-zinc-400 leading-relaxed">
			Walk past a pothole that's already been reported nearby? Submit another report at the same
			location — the app will detect the match and count your submission as a confirmation.
			Once a pothole reaches the confirmation threshold (default: 2 independent reports), it
			goes live on the public map.
		</p>
		<p class="text-sm text-zinc-400 leading-relaxed">
			Each IP address can only confirm a given pothole once, so duplicate taps from the same device
			won't inflate the count.
		</p>
	</section>

	<!-- Watchlist -->
	<section class="space-y-4">
		<h2 class="section-title text-xl text-white flex items-center gap-2">
			<Icon name="bookmark" size={18} class="text-sky-400 shrink-0" />
			Watchlist
		</h2>
		<p class="text-sm text-zinc-400 leading-relaxed">
			On any pothole detail page, tap <strong class="text-zinc-200">Watch this hole</strong> to save
			it to your watchlist. Watched holes appear in a section on the homepage so you can quickly
			see whether they've been filled.
		</p>
		<p class="text-sm text-zinc-400 leading-relaxed">
			Your watchlist is stored in your browser's local storage — no account needed,
			but it only persists on the device and browser you used to save it.
		</p>
	</section>

	<!-- Pothole detail page -->
	<section class="space-y-4">
		<h2 class="section-title text-xl text-white flex items-center gap-2">
			<Icon name="info" size={18} class="text-sky-400 shrink-0" />
			Pothole detail page
		</h2>
		<div class="space-y-3 text-sm text-zinc-400 leading-relaxed">
			<p>Tap any pin on the map, or the pothole list, to open its detail page. From there you can:</p>
			<ul class="space-y-2 list-none">
				<li class="flex gap-2.5">
					<Icon name="zap" size={15} class="text-sky-400 shrink-0 mt-0.5" />
					<span><strong class="text-zinc-200">I hit this</strong> — signal that you physically drove over the pothole. Hit counts are shown publicly and help surface the most dangerous holes.</span>
				</li>
				<li class="flex gap-2.5">
					<Icon name="check-circle" size={15} class="text-green-400 shrink-0 mt-0.5" />
					<span><strong class="text-zinc-200">Mark as filled</strong> — if you can see the city has patched it, let the community know.</span>
				</li>
				<li class="flex gap-2.5">
					<Icon name="mail" size={15} class="text-sky-400 shrink-0 mt-0.5" />
					<span><strong class="text-zinc-200">Contact your councillor</strong> — each pothole shows the ward councillor's name and a direct email link pre-filled with the pothole address.</span>
				</li>
				<li class="flex gap-2.5">
					<Icon name="share-2" size={15} class="text-sky-400 shrink-0 mt-0.5" />
					<span><strong class="text-zinc-200">Share</strong> — every pothole has a permanent URL. Share it to Reddit, Bluesky, Facebook, or copy the link to send directly.</span>
				</li>
			</ul>
			<p class="text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
				If a pothole was recently filled nearby once before and re-opened, the detail page will flag it
				as a <strong class="text-zinc-400">repeat pothole</strong> — useful for escalating recurring road issues to the city.
			</p>
		</div>
	</section>

	<!-- Status meanings -->
	<section class="space-y-4">
		<h2 class="section-title text-xl text-white flex items-center gap-2">
			<Icon name="layers" size={18} class="text-sky-400 shrink-0" />
			Pothole statuses
		</h2>
		<div class="grid gap-2 text-sm">
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex gap-3 items-start">
				<span class="w-2.5 h-2.5 rounded-full bg-zinc-500 shrink-0 mt-1.5"></span>
				<div>
					<div class="font-semibold text-zinc-200">Pending</div>
					<p class="text-zinc-500 mt-0.5">Only one report so far. Not yet on the public map. Expires in 14 days if no confirmation arrives.</p>
				</div>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex gap-3 items-start">
				<span class="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0 mt-1.5"></span>
				<div>
					<div class="font-semibold text-zinc-200">Reported</div>
					<p class="text-zinc-500 mt-0.5">Confirmed by multiple people. Live on the public map. Waiting for the city to fix it.</p>
				</div>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex gap-3 items-start">
				<span class="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-1.5"></span>
				<div>
					<div class="font-semibold text-zinc-200">Filled</div>
					<p class="text-zinc-500 mt-0.5">Community confirmed the city patched it. Still on the map for accountability tracking.</p>
				</div>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex gap-3 items-start">
				<span class="w-2.5 h-2.5 rounded-full bg-zinc-600 shrink-0 mt-1.5"></span>
				<div>
					<div class="font-semibold text-zinc-200">Expired</div>
					<p class="text-zinc-500 mt-0.5">No fill event after 90 days. Automatically closed to keep the map current.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Push notifications -->
	<section class="space-y-4">
		<h2 class="section-title text-xl text-white flex items-center gap-2">
			<Icon name="bell" size={18} class="text-sky-400 shrink-0" />
			Push notifications
		</h2>
		<p class="text-sm text-zinc-400 leading-relaxed">
			Tap the bell icon in the top nav to subscribe to browser push notifications.
			You'll get a ping whenever a pothole in the region gets filled — no app install required,
			works on Android and desktop browsers that support web push.
		</p>
		<p class="text-sm text-zinc-400 leading-relaxed">
			Tap the bell again to unsubscribe at any time. Notifications are sent server-side —
			no personal data is stored beyond the push endpoint your browser provides.
		</p>
	</section>

	<!-- Stats -->
	<section class="space-y-4">
		<h2 class="section-title text-xl text-white flex items-center gap-2">
			<Icon name="bar-chart-2" size={18} class="text-sky-400 shrink-0" />
			Stats page
		</h2>
		<p class="text-sm text-zinc-400 leading-relaxed">
			The <a href="/stats" class="text-sky-400 underline hover:text-sky-300 transition-colors">Stats page</a>
			shows accountability data across the whole region:
		</p>
		<ul class="space-y-1.5 text-sm text-zinc-400 list-none">
			<li class="flex gap-2"><Icon name="check" size={14} class="text-sky-500 shrink-0 mt-0.5" /> Ward leaderboards and letter grades (A–F) based on fill rate and response time</li>
			<li class="flex gap-2"><Icon name="check" size={14} class="text-sky-500 shrink-0 mt-0.5" /> Average time from report to fill, across the whole dataset</li>
			<li class="flex gap-2"><Icon name="check" size={14} class="text-sky-500 shrink-0 mt-0.5" /> Hotspot streets with the most active potholes</li>
			<li class="flex gap-2"><Icon name="check" size={14} class="text-sky-500 shrink-0 mt-0.5" /> Monthly fill rate trends over time</li>
		</ul>
	</section>

	<!-- For journalists / open data -->
	<section class="space-y-4" id="open-data">
		<h2 class="section-title text-xl text-white flex items-center gap-2">
			<Icon name="download" size={18} class="text-sky-400 shrink-0" />
			For journalists &amp; developers
		</h2>
		<p class="text-sm text-zinc-400 leading-relaxed">
			All pothole data is freely available — no API key, no account.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<a
				href="/api/feed.json"
				class="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-sky-600 transition-colors group"
			>
				<Icon name="globe" size={18} class="text-sky-400 shrink-0 mt-0.5" />
				<div>
					<div class="font-semibold text-white text-sm group-hover:text-sky-300 transition-colors">JSON feed</div>
					<p class="text-xs text-zinc-400 mt-0.5">Recent confirmed potholes with coordinates, address, and status.</p>
				</div>
			</a>
			<a
				href="/api/export.csv"
				class="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-sky-600 transition-colors group"
			>
				<Icon name="download" size={18} class="text-sky-400 shrink-0 mt-0.5" />
				<div>
					<div class="font-semibold text-white text-sm group-hover:text-sky-300 transition-colors">CSV export</div>
					<p class="text-xs text-zinc-400 mt-0.5">Full dataset — id, lat/lng, address, status, dates. Opens in Excel or R.</p>
				</div>
			</a>
			<a
				href="/api/feed.xml"
				class="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-sky-600 transition-colors group"
			>
				<Icon name="rss" size={18} class="text-sky-400 shrink-0 mt-0.5" />
				<div>
					<div class="font-semibold text-white text-sm group-hover:text-sky-300 transition-colors">RSS feed</div>
					<p class="text-xs text-zinc-400 mt-0.5">Subscribe in any RSS reader to get notified of new confirmations and fills.</p>
				</div>
			</a>
			<div class="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-xl p-4">
				<Icon name="code" size={18} class="text-sky-400 shrink-0 mt-0.5" />
				<div>
					<div class="font-semibold text-white text-sm">Embed widget</div>
					<p class="text-xs text-zinc-400 mt-0.5">
						Embed any pothole card on your site via
						<code class="text-zinc-300 bg-zinc-800 px-1 rounded">/api/embed/[id]</code>.
						Returns a self-contained iframe-friendly card.
					</p>
				</div>
			</div>
		</div>
	</section>

	<div class="flex flex-wrap gap-4 pt-2">
		<a href="/" class="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors">
			<Icon name="arrow-left" size={14} />
			Back to the map
		</a>
		<a href="/about" class="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors">
			About this project
		</a>
	</div>
</div>
