<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
</script>

<svelte:head>
	<title>Terms of Use — FillTheHole.ca</title>
	<meta
		name="description"
		content="The terms for using FillTheHole.ca — a free, community-run, open-source pothole tracker for Waterloo Region."
	/>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-12 space-y-10">
	<div>
		<h1 class="page-title text-4xl sm:text-5xl text-stone-900 dark:text-white mb-2">Terms of use</h1>
		<p class="page-intro text-stone-600 dark:text-stone-400 text-lg">
			Plain terms for a free, open-source civic tool. No fine print traps.
		</p>
		<p class="text-xs text-stone-500 dark:text-stone-500 mt-2">Last updated: July 7, 2026</p>
	</div>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">What this is</h2>
		<p class="text-sm">
			FillTheHole.ca is a free, independent, community-run tool for reporting and tracking potholes
			in Waterloo Region, Ontario. It is
			<strong class="text-stone-900 dark:text-stone-300">not affiliated with, endorsed by, or operated by</strong>
			the City of Kitchener, City of Waterloo, City of Cambridge, the Region of Waterloo, the
			Province of Ontario, or any other government body. By using the site you agree to these terms.
		</p>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">Acceptable use</h2>
		<p class="text-sm">Use the site in good faith. Specifically, don't:</p>
		<ul class="list-disc pl-5 space-y-1.5 text-sm">
			<li>Submit false, fake, or deliberately mislocated reports.</li>
			<li>Upload photos you don't have the right to share, or that contain people's faces, licence plates, or other identifying details you'd need consent for.</li>
			<li>Upload content that is illegal, hateful, harassing, sexual, or otherwise inappropriate. Photos are automatically screened and human-reviewed; violations are removed.</li>
			<li>Attempt to bypass the geofence, rate limits, or duplicate-prevention, or automate submissions.</li>
			<li>Scrape, overload, or attack the service. (The open data below means you don't need to scrape — just use the feeds.)</li>
		</ul>
		<p class="text-sm">
			We may remove any report or photo, and block abusive traffic, at our discretion.
		</p>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">Your reports and photos</h2>
		<p class="text-sm">
			You keep ownership of anything you submit. By submitting a report or photo, you grant this
			project a non-exclusive, royalty-free licence to display, store, and distribute it as part of
			the public pothole record and the open datasets below. Because the map is a public
			accountability tool and the data is released openly, treat every submission as public and
			permanent — don't include anything private. Photos are held for moderation and are only
			published after an administrator reviews them.
		</p>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">Safety</h2>
		<div class="flex gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/40 rounded-md p-4 text-sm text-amber-900 dark:text-amber-200/90">
			<Icon name="alert-triangle" size={18} class="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
			<p>
				<strong class="text-amber-800 dark:text-amber-300">Never put yourself in danger to report a pothole.</strong>
				Don't stop in traffic or step onto a road. Report from a sidewalk, a parking lot, or after
				you've safely parked. No pothole is worth an injury. For an urgent road hazard, contact your
				municipality directly.
			</p>
		</div>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">No warranty, no liability</h2>
		<p class="text-sm">
			All pothole data is
			<strong class="text-stone-900 dark:text-stone-300">community-sourced and unverified</strong>.
			Reports may be inaccurate, outdated, or mislocated; a pothole marked "filled" may have been
			re-reported in error. Do not rely on this map as a definitive record of road conditions.
		</p>
		<p class="text-sm">
			The site is provided
			<strong class="text-stone-900 dark:text-stone-300">"as is," without warranty of any kind</strong>,
			express or implied. To the fullest extent permitted by law, the operator is not liable for any
			damage to vehicles, injuries, or losses arising from use of, or reliance on, anything displayed
			here. For official road-hazard reporting, use the city and provincial links on the
			<a href="/about" class="text-amber-700 dark:text-amber-400 underline">About</a> page.
		</p>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">Open data &amp; open source</h2>
		<p class="text-sm">
			The pothole dataset is published openly (<a href="/api/export.csv" class="text-amber-700 dark:text-amber-400 underline">CSV</a>
			and <a href="/api/feed.xml" class="text-amber-700 dark:text-amber-400 underline">RSS</a>) for research,
			journalism, and civic use — no API key required. The site's source code is released under the
			<a href="https://github.com/BreakableHoodie/filltheholedotca/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">GNU AGPL-3.0 licence</a>;
			you're free to read, modify, and self-host it under those terms.
		</p>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">Privacy, changes &amp; governing law</h2>
		<p class="text-sm">
			Your privacy is covered by our <a href="/privacy" class="text-amber-700 dark:text-amber-400 underline">Privacy Policy</a>.
			These terms may change; because they're version-controlled with the
			<a href="https://github.com/BreakableHoodie/filltheholedotca" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">open-source code</a>,
			every revision is public and dated. Continued use after a change means you accept it. These
			terms are governed by the laws of the Province of Ontario and the federal laws of Canada that
			apply there.
		</p>
	</section>

	<div class="text-center pt-4 space-x-4">
		<a href="/privacy" class="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white text-sm transition-colors underline">
			Privacy policy
		</a>
		<a href="/" class="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white text-sm transition-colors">
			<Icon name="arrow-left" size={14} />
			Back to the map
		</a>
	</div>
</div>
