'use strict';

/**
 * Lighthouse CI pre-collection setup script.
 *
 * Pre-seeds the `fth-welcomed` localStorage key so the WelcomeModal is
 * suppressed during audits — the modal appears on every first visit and would
 * otherwise block the home page content, causing the accessibility audit to
 * return a null score.
 *
 * Requires `disableStorageReset: true` in lighthouserc.cjs so that Lighthouse
 * does not wipe localStorage before running the audit itself.
 */
module.exports = async (browser, context) => {
	const page = await browser.newPage();
	await page.goto(context.url, { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => {
		localStorage.setItem('fth-welcomed', '1');
	});
	await page.close();
};
