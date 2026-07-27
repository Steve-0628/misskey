process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { gcd } from '@/misc/prelude/math.js';

describe('prelude/math', () => {
	describe('gcd', () => {
		test('computes greatest common divisor', () => {
			expect(gcd(48, 18)).toBe(6);
			expect(gcd(54, 24)).toBe(6);
			expect(gcd(7, 5)).toBe(1);
		});

		test('returns first number when second is zero', () => {
			expect(gcd(42, 0)).toBe(42);
		});

		test('handles both zero', () => {
			expect(gcd(0, 0)).toBe(0);
		});
	});
});
