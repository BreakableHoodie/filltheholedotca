<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import SocialShare from '$lib/components/SocialShare.svelte';
	import { ABOUT_REPORT_LINKS } from '$lib/official-reporting';
</script>

<svelte:head>
	<title>About — FillTheHole.ca</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-12 space-y-10">
	<div>
		<h1 class="page-title text-4xl sm:text-5xl text-white mb-2">About</h1>
		<p class="page-intro text-zinc-400 text-lg">Civic accountability, one pothole at a time.</p>
	</div>

	<section class="space-y-4 text-zinc-300 leading-relaxed">
		<h2 class="section-title text-xl text-white">Why this exists</h2>
		<p>
			Potholes damage cars, bend bike wheels, and throw cyclists. They're a hazard for
			everyone — drivers, riders, and pedestrians alike. But reporting them through official
			channels often feels like shouting into a void. Forms get submitted. Nothing happens.
			The hole stays.
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
		<h2 class="section-title flex items-center gap-2 text-xl text-white">
			<Icon name="external-link" size={18} class="text-sky-400 shrink-0" />
			Report it officially too
		</h2>
		<p class="text-zinc-400 text-sm">
			This map creates public pressure — but an official report creates a paper trail the city
			is legally required to respond to. Do both.
		</p>
		<div class="space-y-2">
			{#each ABOUT_REPORT_LINKS as link (link.id)}
				<a
					href={link.href}
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors {link.id === 'kitchener' ? 'bg-sky-700 hover:bg-sky-600' : 'bg-zinc-700 hover:bg-zinc-600'}"
				>
					<Icon name="external-link" size={14} class="shrink-0" />
					{link.label}
					{#if link.scope === 'city'}
						— Report a pothole or road issue
					{:else if link.scope === 'region'}
						— Roads &amp; traffic
					{:else}
						— Report a provincial highway problem
					{/if}
				</a>
			{/each}
		</div>
		<div class="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-400 leading-relaxed space-y-2">
			<p>
				<strong class="text-zinc-300">Not sure who maintains the road?</strong> Major roads like
				King St, Victoria St, Weber St, and Erb St are <em>Regional roads</em> maintained by the
				Region of Waterloo — not your local city. Local residential streets belong to whichever
				city you're in. When in doubt, report to both.
			</p>
			<p>
				<strong class="text-zinc-300">Provincial highways (401, 7/8, 85) are MTO's responsibility</strong>,
				not the city or Region. Report those to the
				<a href="https://www.ontario.ca/page/report-problem-provincial-highway" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline">Ministry of Transportation Ontario</a>.
			</p>
		</div>
	</section>

	<section class="space-y-4 text-zinc-300 leading-relaxed">
		<h2 class="section-title text-xl text-white">How it works</h2>
		<p class="text-sm text-zinc-400">
			The basics are below.
			<a href="/how-to" class="text-sky-400 underline hover:text-sky-300 transition-colors">Full how-to guide →</a>
		</p>

		<div class="flex gap-3 bg-amber-950/40 border border-amber-700/40 rounded-xl p-4 text-sm text-amber-200/90">
			<Icon name="alert-triangle" size={18} class="text-amber-400 shrink-0 mt-0.5" />
			<p>
				<strong class="text-amber-300">Stay safe when reporting.</strong>
				Never stop in traffic or step onto a road to report a pothole. Report from the sidewalk,
				parking lot, or after you've safely parked. If you're driving, let a passenger report
				or wait until you've stopped somewhere safe. No pothole is worth an injury.
			</p>
		</div>

		<div class="grid gap-4">
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4 items-start">
				<div class="shrink-0 mt-0.5 p-2 rounded-lg bg-orange-500/10">
					<Icon name="map-pin" size={20} class="text-orange-400" />
				</div>
				<div>
					<div class="font-semibold text-white mb-1">1. Report</div>
					<p class="text-sm text-zinc-400">
						Standing next to a pothole? Open the app on your phone, lock your GPS location,
						and submit. Independent reports from the same location help verify it and put it on the map.
					</p>
				</div>
			</div>

			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4 items-start">
				<div class="shrink-0 mt-0.5 p-2 rounded-lg bg-sky-500/10">
					<Icon name="mail" size={20} class="text-sky-400" />
				</div>
				<div>
					<div class="font-semibold text-white mb-1">2. Contact</div>
					<p class="text-sm text-zinc-400">
						Share the pothole link with your ward councillor or on social media.
						The detail page shows your councillor's contact info and a direct email link.
						The more people who see it, the harder it is to ignore.
					</p>
				</div>
			</div>

			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4 items-start">
				<div class="shrink-0 mt-0.5 p-2 rounded-lg bg-green-500/10">
					<Icon name="check-circle" size={20} class="text-green-400" />
				</div>
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
		<h2 class="section-title text-xl text-white">Privacy</h2>
		<p>
			No accounts. No names. No tracking. Here's exactly what this site does and doesn't do with your data.
		</p>

		<div class="space-y-3">
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<div class="flex items-center gap-2 text-sm font-semibold text-white">
					<Icon name="crosshair" size={14} class="text-zinc-400 shrink-0" />
					GPS coordinates
				</div>
				<p class="text-sm text-zinc-400">
					When you report a pothole, your GPS coordinates are stored to place the pin on the map.
					That's their only purpose. They are never sold, shared with third parties, or tied to any identity.
				</p>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<div class="flex items-center gap-2 text-sm font-semibold text-white">
					<Icon name="info" size={14} class="text-zinc-400 shrink-0" />
					IP addresses
				</div>
				<p class="text-sm text-zinc-400">
					Your IP address is used only to prevent duplicate reports from the same device.
					It is immediately converted to an HMAC-SHA-256 hash with a server-side secret before being
					stored — the raw IP is never written to disk or logged. The hash cannot be reversed back to
					your IP without the secret.
				</p>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<div class="flex items-center gap-2 text-sm font-semibold text-white">
					<Icon name="info" size={14} class="text-zinc-400 shrink-0" />
					Cookies &amp; local storage
				</div>
				<p class="text-sm text-zinc-400">
					This site sets no cookies. A single entry (<code class="text-zinc-300 bg-zinc-800 px-1 rounded text-xs">fth-home-intro-dismissed</code>)
					is stored in your browser's local storage to remember that you've dismissed the homepage introduction.
					It contains no personal information and is never sent to any server.
				</p>
			</div>
			<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
				<div class="flex items-center gap-2 text-sm font-semibold text-white">
					<Icon name="globe" size={14} class="text-zinc-400 shrink-0" />
					Third-party services
				</div>
				<p class="text-sm text-zinc-400">
					Map tiles are loaded from <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline">OpenStreetMap</a>.
					When you report a pothole, your coordinates are sent to
					<a href="https://nominatim.org" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline">Nominatim</a> (OpenStreetMap's geocoder)
					to look up the street address. Report data is stored in
					<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline">Supabase</a>.
					Each of these services has its own privacy policy.
				</p>
			</div>
		</div>

		<p class="text-sm text-zinc-400">
			Questions? This is an <a href="https://github.com/BreakableHoodie/filltheholedotca" target="_blank" rel="noopener noreferrer" class="underline hover:text-white transition-colors">open-source civic project</a> with no commercial interest in your data.
		</p>
	</section>

	<section class="space-y-4 text-zinc-300 leading-relaxed" id="disclaimer">
		<h2 class="section-title text-xl text-white">Disclaimer</h2>
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

	<section class="space-y-3 text-zinc-300 leading-relaxed">
		<h2 class="section-title text-xl text-white">Open source</h2>
		<p class="text-zinc-400 text-sm">
			fillthehole.ca is free, open-source software built for the public good. No ads, no investors, no data harvesting.
			Read the code, file an issue, or contribute a fix.
		</p>
		<a
			href="https://github.com/BreakableHoodie/filltheholedotca"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
		>
			<Icon name="github" size={16} class="shrink-0" />
			BreakableHoodie/filltheholedotca
		</a>
	</section>

	<section class="space-y-4" id="open-data">
		<h2 class="section-title text-xl text-white">Open data</h2>
		<p class="text-zinc-400 text-sm">
			All confirmed pothole data is freely available for research, journalism, or civic apps.
			No API key required.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<a
				href="/api/export.csv"
				class="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-sky-600 transition-colors group"
			>
				<Icon name="download" size={18} class="text-sky-400 shrink-0 mt-0.5" />
				<div>
					<div class="font-semibold text-white text-sm group-hover:text-sky-300 transition-colors">CSV export</div>
					<p class="text-xs text-zinc-400 mt-0.5">All reported, filled &amp; expired potholes — id, lat/lng, address, status, dates.</p>
				</div>
			</a>
			<a
				href="/api/feed.xml"
				class="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-sky-600 transition-colors group"
			>
				<Icon name="rss" size={18} class="text-sky-400 shrink-0 mt-0.5" />
				<div>
					<div class="font-semibold text-white text-sm group-hover:text-sky-300 transition-colors">RSS feed</div>
					<p class="text-xs text-zinc-400 mt-0.5">Recently reported and filled potholes, ordered by event time. Subscribe in any RSS reader.</p>
				</div>
			</a>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="section-title text-xl text-white">Spread the word</h2>
		<p class="text-zinc-400 text-sm">
			This project runs on word of mouth — no ads, no algorithm. If the map helped you,
			share it with your neighbours, your local community group, or anywhere people talk about
			life in Waterloo Region.
		</p>
		<SocialShare />
	</section>

	<div class="text-center pt-4">
		<a href="/" class="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors">
			<Icon name="arrow-left" size={14} />
			Back to the map
		</a>
	</div>
</div>
