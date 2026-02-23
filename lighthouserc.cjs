module.exports = {
	ci: {
		collect: {
			startServerCommand: 'npm run preview',
			startServerReadyPattern: 'localhost:4173',
			startServerReadyTimeout: 60000,
			url: [
				'http://localhost:4173/',
				'http://localhost:4173/report',
				'http://localhost:4173/about',
				'http://localhost:4173/stats'
			],
			numberOfRuns: 1,
			settings: {
				// Required for headless Chrome in CI
				chromeFlags: '--no-sandbox --disable-setuid-sandbox',
				// Preserve the localStorage set by the puppeteer setup script so the
				// WelcomeModal is suppressed. Without this, Lighthouse clears storage
				// before auditing and the script's work is undone.
				disableStorageReset: true,
				puppeteerScript: './lighthouse-setup.cjs'
			}
		},
		assert: {
			// Per-URL assertion matrix — the home page carries Leaflet + clustering
			// + ward GeoJSON so its performance budget is intentionally lower.
			assertMatrix: [
				{
					matchingUrlPattern: 'http://localhost:4173/$',
					assertions: {
						'categories:performance': ['warn', { minScore: 0.5 }],
						// Accessibility regressions are never acceptable for a public civic tool.
						'categories:accessibility': ['error', { minScore: 0.9 }],
						'categories:best-practices': ['error', { minScore: 0.9 }],
						'categories:seo': ['warn', { minScore: 0.85 }]
					}
				},
				{
					matchingUrlPattern: '.*',
					assertions: {
						'categories:performance': ['warn', { minScore: 0.6 }],
						'categories:accessibility': ['error', { minScore: 0.9 }],
						'categories:best-practices': ['error', { minScore: 0.9 }],
						'categories:seo': ['warn', { minScore: 0.85 }]
					}
				}
			]
		},
		upload: {
			target: 'temporary-public-storage'
		}
	}
};
