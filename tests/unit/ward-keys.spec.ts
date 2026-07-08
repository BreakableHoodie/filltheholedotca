import { test, expect } from '@playwright/test';
import { WARD_KEYS, isKnownWardKey } from '../../src/lib/wards';

test('ward keys cover all councillors and validate', () => {
	expect(WARD_KEYS).toContain('kitchener-6');
	expect(WARD_KEYS.length).toBe(25); // Kitchener 10 + Waterloo 7 + Cambridge 8
	expect(isKnownWardKey('kitchener-6')).toBe(true);
	expect(isKnownWardKey('kitchener-99')).toBe(false);
	expect(isKnownWardKey('../etc')).toBe(false);
});
