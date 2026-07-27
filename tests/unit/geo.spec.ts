// tests/unit/geo.spec.ts
import { test, expect } from '@playwright/test';
import { roundPublicCoord, pipRing, inWardFeature, haversineMetres } from '../../src/lib/geo';

test.describe('roundPublicCoord', () => {
	// This constant IS the app's coordinate-privacy control. Pin it to exactly
	// 4 decimal places so a future regression to 5/6 decimals fails loudly.
	test('rounds up to exactly 4 decimal places', () => {
		expect(roundPublicCoord(43.4516789)).toBe(43.4517);
	});

	test('rounds down to exactly 4 decimal places', () => {
		expect(roundPublicCoord(43.45161234)).toBe(43.4516);
	});

	test('is idempotent for a value already at 4 decimal places', () => {
		const once = roundPublicCoord(43.4516);
		expect(once).toBe(43.4516);
		expect(roundPublicCoord(once)).toBe(43.4516);
	});

	test('handles a negative longitude (Waterloo lngs are all negative)', () => {
		expect(roundPublicCoord(-80.4925123)).toBe(-80.4925);
	});

	test('rounds a negative longitude up in magnitude when the 5th decimal is >= 5', () => {
		expect(roundPublicCoord(-80.49257891)).toBe(-80.4926);
	});

	test('returns zero for zero', () => {
		expect(roundPublicCoord(0)).toBe(0);
	});
});

test.describe('pipRing', () => {
	// Simple axis-aligned square, [lng, lat] pairs, spanning (0,0)-(10,10).
	const square = [
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10],
	];

	test('a point clearly inside a simple square ring', () => {
		expect(pipRing(5, 5, square)).toBe(true);
	});

	test('a point clearly outside a simple square ring', () => {
		expect(pipRing(20, 20, square)).toBe(false);
	});

	test('a point outside sharing a y-coordinate with two vertices (classic ray-casting vertex bug)', () => {
		// A diamond (rotated square) whose left and right vertices both sit at
		// lat=5. A naive ray-casting implementation can double-toggle "inside"
		// when the horizontal test ray passes exactly through such vertices.
		const diamond = [
			[0, 5],
			[5, 10],
			[10, 5],
			[5, 0],
		];
		expect(pipRing(-5, 5, diamond)).toBe(false);
		// Sanity check: the same diamond correctly reports its centre as inside.
		expect(pipRing(5, 5, diamond)).toBe(true);
	});

	test('degenerate ring where consecutive vertices share the same y does not throw or produce NaN', () => {
		// square's bottom edge (0,0)-(10,0) and top edge (10,10)-(0,10) are both
		// horizontal (yj - yi === 0 for that edge), exercising the division in
		// the ray-casting formula without it ever being evaluated for that edge.
		const result = pipRing(100, 0, square);
		expect(Number.isNaN(result)).toBe(false);
		expect(result).toBe(false);
	});
});

test.describe('inWardFeature', () => {
	const polygon = {
		type: 'Polygon' as const,
		coordinates: [
			[
				[-80.55, 43.45],
				[-80.5, 43.45],
				[-80.5, 43.4],
				[-80.55, 43.4],
				[-80.55, 43.45],
			],
		],
	};

	test('Polygon: point inside the ring', () => {
		expect(inWardFeature(-80.525, 43.425, polygon)).toBe(true);
	});

	test('Polygon: point outside the ring', () => {
		expect(inWardFeature(-80.6, 43.425, polygon)).toBe(false);
	});

	const multiPolygon = {
		type: 'MultiPolygon' as const,
		coordinates: [
			[
				[
					[-80.55, 43.45],
					[-80.5, 43.45],
					[-80.5, 43.4],
					[-80.55, 43.4],
					[-80.55, 43.45],
				],
			],
			[
				[
					[-80.35, 43.4],
					[-80.3, 43.4],
					[-80.3, 43.35],
					[-80.35, 43.35],
					[-80.35, 43.4],
				],
			],
		],
	};

	test('MultiPolygon: point inside the first sub-polygon', () => {
		expect(inWardFeature(-80.525, 43.425, multiPolygon)).toBe(true);
	});

	test('MultiPolygon: point inside the second sub-polygon', () => {
		expect(inWardFeature(-80.325, 43.375, multiPolygon)).toBe(true);
	});

	test('MultiPolygon: point outside both sub-polygons', () => {
		expect(inWardFeature(-80.0, 43.0, multiPolygon)).toBe(false);
	});
});

test.describe('haversineMetres', () => {
	test('computes ~18m between two nearby Waterloo-area points', () => {
		// Uptown Waterloo, offset ~0.00016° north (~17.8m at this latitude).
		const distance = haversineMetres(43.4643, -80.5204, 43.4643 + 0.00016, -80.5204);
		expect(distance).toBeCloseTo(17.79, 1);
	});

	test('returns zero for identical points', () => {
		expect(haversineMetres(43.4643, -80.5204, 43.4643, -80.5204)).toBe(0);
	});
});
