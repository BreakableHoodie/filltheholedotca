import { test, expect } from '@playwright/test';
import { isSafePushEndpoint } from '../../src/lib/server/ssrf';

test.describe('isSafePushEndpoint', () => {
	// ── Allowed ────────────────────────────────────────────────────────────────

	test('allows a public HTTPS push endpoint', () => {
		expect(isSafePushEndpoint('https://fcm.googleapis.com/fcm/send/abc123')).toBe(true);
		expect(isSafePushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
	});

	// ── Protocol ───────────────────────────────────────────────────────────────

	test('rejects HTTP endpoints', () => {
		expect(isSafePushEndpoint('http://fcm.googleapis.com/push')).toBe(false);
	});

	test('rejects non-URL strings', () => {
		expect(isSafePushEndpoint('not-a-url')).toBe(false);
		expect(isSafePushEndpoint('')).toBe(false);
	});

	// ── IPv4 loopback / private ────────────────────────────────────────────────

	test('rejects localhost', () => {
		expect(isSafePushEndpoint('https://localhost/push')).toBe(false);
	});

	test('rejects 127.x.x.x loopback', () => {
		expect(isSafePushEndpoint('https://127.0.0.1/push')).toBe(false);
		expect(isSafePushEndpoint('https://127.1.2.3/push')).toBe(false);
	});

	test('rejects 10.x.x.x private range', () => {
		expect(isSafePushEndpoint('https://10.0.0.1/push')).toBe(false);
		expect(isSafePushEndpoint('https://10.255.255.255/push')).toBe(false);
	});

	test('rejects 172.16–31.x.x private range', () => {
		expect(isSafePushEndpoint('https://172.16.0.1/push')).toBe(false);
		expect(isSafePushEndpoint('https://172.31.255.255/push')).toBe(false);
		// 172.15 and 172.32 are public
		expect(isSafePushEndpoint('https://172.15.0.1/push')).toBe(true);
		expect(isSafePushEndpoint('https://172.32.0.1/push')).toBe(true);
	});

	test('rejects 192.168.x.x private range', () => {
		expect(isSafePushEndpoint('https://192.168.1.1/push')).toBe(false);
	});

	test('rejects 169.254.x.x link-local', () => {
		expect(isSafePushEndpoint('https://169.254.0.1/push')).toBe(false);
	});

	// ── IPv6 ──────────────────────────────────────────────────────────────────
	// WHATWG URL API includes brackets in url.hostname for IPv6 literals.

	test('rejects IPv6 loopback ::1', () => {
		expect(isSafePushEndpoint('https://[::1]/push')).toBe(false);
	});

	test('rejects IPv6 link-local fe80::/10', () => {
		expect(isSafePushEndpoint('https://[fe80::1]/push')).toBe(false);
		expect(isSafePushEndpoint('https://[fe80::abcd]/push')).toBe(false);
		expect(isSafePushEndpoint('https://[febf::1]/push')).toBe(false);
		// fec0 is NOT in fe80::/10 (first 10 bits differ)
		expect(isSafePushEndpoint('https://[fec0::1]/push')).toBe(true);
	});

	test('rejects IPv6 unique-local fc00::/7', () => {
		expect(isSafePushEndpoint('https://[fc00::1]/push')).toBe(false);
		expect(isSafePushEndpoint('https://[fd00::1]/push')).toBe(false);
		expect(isSafePushEndpoint('https://[fdff::1]/push')).toBe(false);
	});

	test('rejects IPv4-mapped IPv6 ::ffff:', () => {
		// Node.js normalises ::ffff:127.0.0.1 → ::ffff:7f00:1
		expect(isSafePushEndpoint('https://[::ffff:127.0.0.1]/push')).toBe(false);
		expect(isSafePushEndpoint('https://[::ffff:192.168.1.1]/push')).toBe(false);
	});
});
