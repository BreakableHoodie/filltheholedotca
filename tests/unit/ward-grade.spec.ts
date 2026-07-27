// tests/unit/ward-grade.spec.ts
import { test, expect } from '@playwright/test';
import { wardGrade } from '../../src/lib/ward-grade';

test.describe('wardGrade — small-sample cutoff', () => {
	test('just below the 5-report threshold returns the placeholder, even with a perfect score', () => {
		expect(wardGrade(100, 0, 4)).toEqual({ grade: '—', color: 'text-zinc-600' });
	});

	test('exactly at the 5-report threshold returns a real letter grade', () => {
		expect(wardGrade(100, 0, 5)).toEqual({ grade: 'A', color: 'text-green-400' });
	});
});

test.describe('wardGrade — 70/30 weighting between fill rate and speed', () => {
	test('a maxed-out fill rate with no speed bonus caps at B, not A (fill rate is worth 70, not 100)', () => {
		expect(wardGrade(100, null, 10)).toEqual({ grade: 'B', color: 'text-sky-400' });
	});

	test('a zero fill rate with the fastest possible speed bonus caps at D, not C (speed is worth only 30)', () => {
		expect(wardGrade(0, 5, 10)).toEqual({ grade: 'D', color: 'text-orange-400' });
	});

	test('a mid fill rate plus the fast-speed bonus lands exactly where the 70/30 split predicts', () => {
		// score = (50/100)*70 + 30 = 65 -> B
		expect(wardGrade(50, 5, 10)).toEqual({ grade: 'B', color: 'text-sky-400' });
	});
});

test.describe('wardGrade — letter thresholds', () => {
	test('squarely in the A band (score 100)', () => {
		expect(wardGrade(100, 5, 10)).toEqual({ grade: 'A', color: 'text-green-400' });
	});

	test('squarely in the B band (score 65)', () => {
		expect(wardGrade(50, 5, 10)).toEqual({ grade: 'B', color: 'text-sky-400' });
	});

	test('squarely in the C band (score 50)', () => {
		expect(wardGrade(50, 45, 10)).toEqual({ grade: 'C', color: 'text-yellow-400' });
	});

	test('squarely in the D band (score 22)', () => {
		expect(wardGrade(0, 20, 10)).toEqual({ grade: 'D', color: 'text-orange-400' });
	});

	test('squarely in the F band (score 0)', () => {
		expect(wardGrade(0, null, 10)).toEqual({ grade: 'F', color: 'text-red-400' });
	});

	test('exactly on the A boundary (score 80) grades A, pinning >= not >', () => {
		expect(wardGrade(500 / 7, 5, 10)).toEqual({ grade: 'A', color: 'text-green-400' });
	});

	test('exactly on the B boundary (score 60) grades B, pinning >= not >', () => {
		expect(wardGrade(450 / 7, 45, 10)).toEqual({ grade: 'B', color: 'text-sky-400' });
	});

	test('exactly on the C boundary (score 40) grades C, pinning >= not >', () => {
		expect(wardGrade(100 / 7, 5, 10)).toEqual({ grade: 'C', color: 'text-yellow-400' });
	});

	test('exactly on the D boundary (score 20) grades D, pinning >= not >', () => {
		expect(wardGrade(50 / 7, 45, 10)).toEqual({ grade: 'D', color: 'text-orange-400' });
	});
});
