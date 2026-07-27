// tests/unit/escape.spec.ts
import { test, expect } from '@playwright/test';
import { escapeHtml, decodeHtmlEntities } from '../../src/lib/escape';

test.describe('escapeHtml', () => {
	test('escapes all five HTML metacharacters', () => {
		expect(escapeHtml('&')).toBe('&amp;');
		expect(escapeHtml('<')).toBe('&lt;');
		expect(escapeHtml('>')).toBe('&gt;');
		expect(escapeHtml('"')).toBe('&quot;');
		expect(escapeHtml("'")).toBe('&#039;');
	});

	test('escapes & in a single pass, so a literal "&lt;" becomes "&amp;lt;" not "&lt;"', () => {
		// This is the double-escaping trap: replacing "<" before "&" (or
		// re-scanning already-escaped output) would turn a bare "<" into
		// "&amp;lt;" instead of "&lt;", and would leave a literal "&lt;" as
		// "&lt;" instead of correctly escaping its ampersand.
		expect(escapeHtml('<')).toBe('&lt;');
		expect(escapeHtml('&lt;')).toBe('&amp;lt;');
	});

	test('escapes a realistic XSS payload aimed at Leaflet bindPopup', () => {
		const payload = `<img src=x onerror="alert('XSS')">`;
		expect(escapeHtml(payload)).toBe(
			'&lt;img src=x onerror=&quot;alert(&#039;XSS&#039;)&quot;&gt;',
		);
	});

	test('returns an empty string unchanged', () => {
		expect(escapeHtml('')).toBe('');
	});

	test('leaves a string with no special characters unchanged', () => {
		expect(escapeHtml('100 Regina St S, Waterloo, ON')).toBe('100 Regina St S, Waterloo, ON');
	});
});

test.describe('decodeHtmlEntities', () => {
	test('decodes all five entities back to their raw characters', () => {
		expect(decodeHtmlEntities('&amp;')).toBe('&');
		expect(decodeHtmlEntities('&lt;')).toBe('<');
		expect(decodeHtmlEntities('&gt;')).toBe('>');
		expect(decodeHtmlEntities('&quot;')).toBe('"');
	});

	test('decodes both the numeric apostrophe entity forms (&#39; and &#039;)', () => {
		expect(decodeHtmlEntities('&#39;')).toBe("'");
		expect(decodeHtmlEntities('&#039;')).toBe("'");
	});

	test('returns an empty string unchanged', () => {
		expect(decodeHtmlEntities('')).toBe('');
	});
});

test.describe('escapeHtml / decodeHtmlEntities round-trip', () => {
	test('decoding an escaped string reproduces the original, including a literal "&" and "<fun>"', () => {
		// Exercises all five metacharacters together, plus a substring ("&") that
		// would collide with entity decoding if & were not decoded last.
		const original = `<script>if (1 && 2) alert("XSS 'test' & <fun>")</script>`;
		const escaped = escapeHtml(original);
		expect(decodeHtmlEntities(escaped)).toBe(original);
	});
});
