<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
</script>

<svelte:head>
	<title>Privacy Policy — FillTheHole.ca</title>
	<meta
		name="description"
		content="What FillTheHole.ca collects, why, how long it's kept, and which services are involved — in plain language."
	/>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-12 space-y-10">
	<div>
		<h1 class="page-title text-4xl sm:text-5xl text-stone-900 dark:text-white mb-2">Privacy policy</h1>
		<p class="page-intro text-stone-600 dark:text-stone-400 text-lg">
			No accounts. No names. No ad tracking. Here's everything this site does with data, in plain
			language.
		</p>
		<p class="text-xs text-stone-500 dark:text-stone-500 mt-2">Last updated: July 7, 2026</p>
	</div>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">The short version</h2>
		<ul class="list-disc pl-5 space-y-2 text-sm">
			<li>Reporting a pothole stores its location, an approximate street address, your description, and a timestamp — nothing about you.</li>
			<li>Your IP address is one-way hashed the moment a request arrives and is used only to stop duplicates and abuse. The raw IP is never stored or logged by this app.</li>
			<li>Photos have all hidden metadata (EXIF, GPS tags) stripped on the server before anything else happens to them.</li>
			<li>Everything expires: most operational records are automatically purged within 90 days.</li>
			<li>The pothole record itself — location, status, how long it took to fill — is a permanent public dataset. That's the point of the site.</li>
		</ul>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">What we collect, and why</h2>

		<div class="space-y-3">
			<div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md p-4 space-y-1">
				<div class="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-white">
					<Icon name="crosshair" size={14} class="text-stone-400 dark:text-stone-500 shrink-0" />
					Report details
				</div>
				<p class="text-sm">
					When you report a pothole we store its GPS coordinates (rounded to roughly 11&nbsp;m
					before storage), a street address looked up from those coordinates, the severity and
					description you provide, and timestamps. This is what appears on the public map. None of
					it is tied to an identity.
				</p>
			</div>

			<div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md p-4 space-y-1">
				<div class="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-white">
					<Icon name="info" size={14} class="text-stone-400 dark:text-stone-500 shrink-0" />
					IP addresses — hashed, never stored raw
				</div>
				<p class="text-sm">
					To stop one person from confirming their own report over and over, or flooding the
					site, we need to tell devices apart. Your IP address is immediately converted to an
					HMAC-SHA-256 hash using a server-side secret; only the hash is stored, and only for
					duplicate-prevention and rate-limiting. The raw IP is never written to disk or logged by
					this application, and the hash can't be reversed without the secret.
				</p>
			</div>

			<div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md p-4 space-y-1">
				<div class="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-white">
					<Icon name="camera" size={14} class="text-stone-400 dark:text-stone-500 shrink-0" />
					Photos
				</div>
				<p class="text-sm">
					Uploaded photos are processed server-side before storage: all embedded metadata (EXIF,
					GPS tags, comments) is stripped, then the image is screened by an automated moderation
					service and held for review. Photos are never shown publicly until a site administrator
					explicitly publishes them.
				</p>
			</div>

			<div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md p-4 space-y-1">
				<div class="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-white">
					<Icon name="bell" size={14} class="text-stone-400 dark:text-stone-500 shrink-0" />
					Notifications (optional)
				</div>
				<p class="text-sm">
					If you turn on push notifications, we store the anonymous delivery endpoint your browser
					generates — no email, no phone number. Per-pothole "notify me when filled"
					subscriptions are deleted as soon as the notification is sent.
				</p>
			</div>
		</div>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">What stays on your device</h2>
		<p class="text-sm">
			The site sets no cookies for visitors. (Site administrators receive session cookies after
			logging in.) A few entries live in your browser's local storage and are never used to track
			you:
		</p>
		<ul class="list-disc pl-5 space-y-1.5 text-sm">
			<li><code class="text-stone-900 dark:text-stone-300 bg-stone-200 dark:bg-stone-800 px-1 rounded text-xs">fth-home-intro-dismissed</code> — remembers you've closed the homepage intro.</li>
			<li><code class="text-stone-900 dark:text-stone-300 bg-stone-200 dark:bg-stone-800 px-1 rounded text-xs">fillthehole_watchlist</code> — the list of reports you've submitted, so the site can show you their status. Stored only in your browser; the IDs are sent to the server only to look up current statuses and are not stored there.</li>
			<li><code class="text-stone-900 dark:text-stone-300 bg-stone-200 dark:bg-stone-800 px-1 rounded text-xs">hit:&lt;id&gt;</code> and <code class="text-stone-900 dark:text-stone-300 bg-stone-200 dark:bg-stone-800 px-1 rounded text-xs">fill-notify:&lt;id&gt;</code> — remember which potholes you've flagged or subscribed to, so buttons show the right state.</li>
		</ul>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">How long we keep things</h2>
		<p class="text-sm">
			Retention isn't a promise in a document — it's enforced by automated nightly purge jobs in
			the database:
		</p>
		<div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md p-4">
			<ul class="space-y-1.5 text-sm">
				<li><strong class="text-stone-900 dark:text-stone-300">Pothole records</strong> (location, address, description, status, dates) — kept indefinitely as the public accountability record.</li>
				<li><strong class="text-stone-900 dark:text-stone-300">Published photos</strong> — kept with their pothole record; administrators can remove them.</li>
				<li><strong class="text-stone-900 dark:text-stone-300">Confirmation records</strong> (hashed IP) — purged 90 days after a pothole is filled or expires.</li>
				<li><strong class="text-stone-900 dark:text-stone-300">"I hit this" signals, action logs, rate-limit records</strong> — purged after 90 days.</li>
				<li><strong class="text-stone-900 dark:text-stone-300">Push subscriptions</strong> — purged after 180 days without use; fill-notification subscriptions are deleted when the notification is sent.</li>
				<li><strong class="text-stone-900 dark:text-stone-300">Administrator sign-in attempts</strong> — purged after 90 days; the admin audit log is kept 24 months to support breach investigation.</li>
			</ul>
		</div>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">Services we rely on</h2>
		<p class="text-sm">
			The site runs on a small set of infrastructure and data services. Here's each one and exactly
			what it receives:
		</p>
		<div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md p-4">
			<ul class="space-y-1.5 text-sm">
				<li><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">Supabase</a> — hosts the database and photo storage described above.</li>
				<li><a href="https://www.netlify.com/privacy/" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">Netlify</a> — serves the website. As the hosting provider it processes network traffic (including IP addresses) to deliver pages, under its own policy.</li>
				<li><a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">OpenStreetMap</a> — your browser loads map tiles directly from OSM's servers, which see your IP and the map areas you view.</li>
				<li><a href="https://nominatim.org" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">Nominatim</a> — street-address lookups. Requests go through our server, so Nominatim receives coordinates and search text but never your IP.</li>
				<li><a href="https://www.esri.com/en-us/privacy/main" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">Esri ArcGIS</a> — on pothole pages we check Kitchener's 311 system for a matching repair request. Our server sends only the pothole's rounded coordinates.</li>
				<li><a href="https://sightengine.com/policies/privacy" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">SightEngine</a> — uploaded photos (already metadata-stripped) are screened for inappropriate content before an administrator reviews them.</li>
				<li><a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">Sentry</a> — if something breaks, a technical error report (page, browser type, stack trace) is sent so bugs get fixed. We don't attach names or identifiers.</li>
				<li><strong class="text-stone-900 dark:text-stone-300">Browser push services</strong> — if you enable notifications, delivery goes through your browser vendor's push service (Apple, Google, or Mozilla) using the anonymous endpoint your browser created.</li>
				<li><a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">Open-Meteo</a> — regional weather history for the stats page's freeze–thaw chart. Requests use a fixed region-wide coordinate; no user data is involved.</li>
				<li><a href="https://bsky.app" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">Bluesky</a> — confirmed potholes and fills may be auto-posted to a public feed. Only already-public map data is posted.</li>
			</ul>
		</div>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">Your rights</h2>
		<p class="text-sm">
			Under Canada's federal privacy law (PIPEDA) you can ask what information an organization
			holds about you, ask for corrections, and challenge how it's handled. Honest caveat: because
			this site stores no identities and IP hashes are one-way, we usually
			<em>cannot</em> link any report to a person — which protects you, but also means we can't
			prove who submitted what. We'll still act on any reasonable request to correct or remove a
			report or photo. Open an issue on
			<a href="https://github.com/BreakableHoodie/filltheholedotca/issues" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">GitHub</a>
			or use the contact options there.
		</p>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">Security &amp; breaches</h2>
		<p class="text-sm">
			Traffic is encrypted in transit (HTTPS). The database enforces row-level security, admin
			accounts require multi-factor authentication, and administrative actions are audit-logged. If
			a breach ever creates a real risk of significant harm, we follow a documented incident-response
			process, including notifying the Office of the Privacy Commissioner of Canada and affected
			people as PIPEDA requires.
		</p>
	</section>

	<section class="space-y-4 text-stone-600 dark:text-stone-400 leading-relaxed">
		<h2 class="section-title text-xl text-stone-900 dark:text-white">Changes</h2>
		<p class="text-sm">
			This policy is version-controlled with the site's
			<a href="https://github.com/BreakableHoodie/filltheholedotca" target="_blank" rel="noopener noreferrer" class="text-amber-700 dark:text-amber-400 underline">open-source code</a>
			— every change to it is public, diff-able, and dated. Significant changes will be announced on
			the <a href="/updates" class="text-amber-700 dark:text-amber-400 underline">What's new</a> page.
		</p>
	</section>

	<div class="text-center pt-4 space-x-4">
		<a href="/terms" class="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white text-sm transition-colors underline">
			Terms of use
		</a>
		<a href="/" class="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white text-sm transition-colors">
			<Icon name="arrow-left" size={14} />
			Back to the map
		</a>
	</div>
</div>
