module.exports = {
	ci: {
		collect: {
			startServerCommand: 'npm run preview',
			startServerReadyPattern: 'localhost:4173',
			startServerReadyTimeout: 30000,
			url: [
				'http://localhost:4173/',
				'http://localhost:4173/report',
				'http://localhost:4173/about',
				'http://localhost:4173/stats'
			],
			numberOfRuns: 1,
			settings: {
				// Required for headless Chrome in CI
				chromeFlags: '--no-sandbox --disable-setuid-sandbox'
			}
		},
		assert: {
			assertions: {
				// Map page carries Leaflet + clustering + ward GeoJSON — performance will
				// be moderate by design. Warn rather than error to avoid noise.
				'categories:performance': ['warn', { minScore: 0.6 }],
				// Accessibility regressions are never acceptable for a public civic tool.
				'categories:accessibility': ['error', { minScore: 0.9 }],
				'categories:best-practices': ['error', { minScore: 0.9 }],
				'categories:seo': ['warn', { minScore: 0.85 }]
			}
		},
		upload: {
			target: 'temporary-public-storage'
		}
	}
};
