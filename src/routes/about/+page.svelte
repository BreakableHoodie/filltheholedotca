<svelte:head>
	<title>About — fillthehole.ca</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-12 space-y-10">
	<div>
		<h1 class="text-4xl font-bold text-white mb-2">About 🕳️</h1>
		<p class="text-zinc-400 text-lg">Civic accountability, one pothole at a time.</p>
	</div>

	<section class="space-y-4 text-zinc-300 leading-relaxed">
		<h2 class="text-xl font-bold text-white">Why this exists</h2>
		<p>
			Potholes damage cars, flatten tires, and injure cyclists. They're expensive to ignore —
			for drivers and for cities. But reporting them through official channels often feels
			like shouting into a void. Forms get submitted. Nothing happens. The hole stays.
		</p>
		<p>
			fillthehole.ca makes the problem visible. Every reported pothole goes on a public map.
			Every day it stays unfilled is tracked. Your councillor's contact is one tap away.
		</p>
		<p class="text-sky-300 font-medium">
			Sunlight is the best disinfectant. A public map is hard to ignore.
		</p>
	</section>

	<section class="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
		<h2 class="text-xl font-bold text-white">📋 Report it officially too</h2>
		<p class="text-zinc-400 text-sm">
			This map creates public pressure — but an official report creates a paper trail the city
			is legally required to respond to. Do both.
		</p>
		<div class="space-y-2">
			<a
				href="https://www.kitchener.ca/en/transportation-and-parking/report-a-road-concern.aspx"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
			>
				🏙️ City of Kitchener — Report a Road Concern →
			</a>
			<a
				href="https://www.waterloo.ca/roads-and-cycling/report-a-road-trail-or-sidewalk-issue/"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
			>
				🏙️ City of Waterloo — Report a Road Issue →
			</a>
			<a
				href="https://maps.cambridge.ca/gis/ServiceRequests/Pothole/"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
			>
				🏙️ City of Cambridge — Report a Pothole →
			</a>
			<a
				href="https://www.regionofwaterloo.ca/en/living-here/roads-and-traffic.aspx"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
			>
				🌊 Region of Waterloo — Roads & Traffic →
			</a>
		</div>
		<div class="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-400 leading-relaxed">
			<strong class="text-zinc-300">Not sure who maintains the road?</strong> Major roads like
			King St, Victoria St, Weber St, and Erb St are <em>Regional roads</em> maintained by the
			Region of Waterloo — not your local city. Local residential streets belong to whichever
			city you're in. When in doubt, report to both.
		</div>
	</section>

	<section class="space-y-4 text-zinc-300 leading-relaxed">
		<h2 class="text-xl font-bold text-white">How it works</h2>

		<div class="grid gap-4">
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4 items-start">
				<span class="text-3xl mt-1">📍</span>
				<div>
					<div class="font-semibold text-white mb-1">1. Report</div>
					<p class="text-sm text-zinc-400">
						Standing next to a pothole? Open the app on your phone, lock your GPS location,
						and submit. Three independent reports from the same location confirms it's real
						and puts it on the map.
					</p>
				</div>
			</div>

			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4 items-start">
				<span class="text-3xl mt-1">🚩</span>
				<div>
					<div class="font-semibold text-white mb-1">2. Flag it</div>
					<p class="text-sm text-zinc-400">
						Go to a reported pothole, confirm it's still there, and file an official complaint
						through the city's service request system. Then come back and mark it flagged here.
						The more official reports, the harder it is to ignore.
					</p>
				</div>
			</div>

			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4 items-start">
				<span class="text-3xl mt-1">✅</span>
				<div>
					<div class="font-semibold text-white mb-1">3. Watch it get filled</div>
					<p class="text-sm text-zinc-400">
						When the city fills it, mark it done. The counter goes up. The data stays public —
						showing how long repairs take across the city.
					</p>
				</div>
			</div>
		</div>
	</section>

	<section class="space-y-4 text-zinc-300 leading-relaxed" id="privacy">
		<h2 class="text-xl font-bold text-white">Privacy</h2>
		<p>
			No accounts. No names. No tracking. Here's exactly what this site does and doesn't do with your data.
		</p>

		<div class="space-y-3">
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<div class="text-sm font-semibold text-white">📍 GPS coordinates</div>
				<p class="text-sm text-zinc-400">
					When you report a pothole, your GPS coordinates are stored to place the pin on the map.
					That's their only purpose. They are never sold, shared with third parties, or tied to any identity.
				</p>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<div class="text-sm font-semibold text-white">🔒 IP addresses</div>
				<p class="text-sm text-zinc-400">
					Your IP address is used only to prevent duplicate reports from the same device.
					It is immediately converted to a one-way SHA-256 hash before being stored — the raw IP
					is never written to disk or logged. The hash cannot be reversed back to your IP.
				</p>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<div class="text-sm font-semibold text-white">🍪 Cookies & local storage</div>
				<p class="text-sm text-zinc-400">
					This site sets no cookies. A single entry (<code class="text-zinc-300 bg-zinc-800 px-1 rounded text-xs">fth-welcomed</code>)
					is stored in your browser's local storage to remember that you've seen the welcome screen.
					It contains no personal information and is never sent to any server.
				</p>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<div class="text-sm font-semibold text-white">🌐 Third-party services</div>
				<p class="text-sm text-zinc-400">
					Map tiles are loaded from <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:underline">OpenStreetMap</a>.
					When you report a pothole, your coordinates are sent to
					<a href="https://nominatim.org" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:underline">Nominatim</a> (OpenStreetMap's geocoder)
					to look up the street address. Report data is stored in
					<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:underline">Supabase</a>.
					Each of these services has its own privacy policy.
				</p>
			</div>
		</div>

		<p class="text-sm text-zinc-500">
			Questions? This is an open-source civic project with no commercial interest in your data.
		</p>
	</section>

	<section class="space-y-4 text-zinc-300 leading-relaxed" id="disclaimer">
		<h2 class="text-xl font-bold text-white">Disclaimer</h2>
		<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3 text-sm text-zinc-400 leading-relaxed">
			<p>
				fillthehole.ca is an independent community tool. It is <strong class="text-zinc-300">not affiliated with, endorsed by, or operated by</strong> the City of Kitchener, City of Waterloo, City of Cambridge, the Region of Waterloo, or any other government body.
			</p>
			<p>
				All pothole data is <strong class="text-zinc-300">community-sourced and unverified</strong>.
				Reports may be inaccurate, outdated, or mislocated. A pothole marked "filled" may have been re-reported in error.
				Do not rely on this map as a definitive record of road conditions.
			</p>
			<p>
				This site is provided <strong class="text-zinc-300">as-is, without warranty of any kind</strong>.
				The operator is not liable for any damage to vehicles, injuries, or losses arising from reliance on information displayed here.
			</p>
			<p>
				For official road hazard reporting, use the city links above. For emergencies, contact 311 or your local municipality directly.
			</p>
		</div>
	</section>

	<div class="text-center pt-4">
		<a href="/" class="text-zinc-500 hover:text-zinc-300 text-sm">← Back to the map</a>
	</div>
</div>
