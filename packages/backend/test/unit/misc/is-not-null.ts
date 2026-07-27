process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { isNotNull } from '@/misc/is-not-null.js';

describe('isNotNull', () => {
	test('returns true for non-nullish values', () => {
		expect(isNotNull(0)).toBe(true);
		expect(isNotNull('')).toBe(true);
		expect(isNotNull(false)).toBe(true);
		expect(isNotNull({})).toBe(true);
		expect(isNotNull([])).toBe(true);
	});

	test('returns false for null', () => {
		expect(isNotNull(null)).toBe(false);
	});

	test('returns false for undefined', () => {
		expect(isNotNull(undefined)).toBe(false);
	});

	test('narrows type correctly in arrays', () => {
		const values = [1, null, 2, undefined, 3];
		const filtered = values.filter(isNotNull);
		expect(filtered).toEqual([1, 2, 3]);
	});
});
