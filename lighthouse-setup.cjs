'use strict';

/**
 * Lighthouse CI pre-collection setup script.
 *
 * Pre-seeds the `fth-home-intro-dismissed` localStorage key so the homepage
 * intro card is suppressed during audits. Without this, the first-visit intro
 * would cover part of the home page and skew the accessibility audit.
 *
 * Requires `disableStorageReset: true` in lighthouserc.cjs so that Lighthouse
 * does not wipe localStorage before running the audit itself.
 */
module.exports = async (browser, context) => {
	const page = await browser.newPage();
	await page.goto(context.url, { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => {
		localStorage.setItem('fth-home-intro-dismissed', '1');
	});
	await page.close();
};
