process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import {
	concat,
	capitalize,
	toUpperCase,
	toLowerCase,
} from '@/misc/prelude/string.js';

describe('prelude/string', () => {
	describe('concat', () => {
		test('joins strings', () => {
			expect(concat(['a', 'b', 'c'])).toBe('abc');
		});

		test('returns empty string for empty array', () => {
			expect(concat([])).toBe('');
		});
	});

	describe('capitalize', () => {
		test('uppercases first letter and lowercases rest', () => {
			expect(capitalize('hELLO')).toBe('Hello');
		});

		test('handles single character', () => {
			expect(capitalize('a')).toBe('A');
		});

		test('handles empty string', () => {
			expect(capitalize('')).toBe('');
		});
	});

	describe('toUpperCase', () => {
		test('uppercases entire string', () => {
			expect(toUpperCase('Hello')).toBe('HELLO');
		});
	});

	describe('toLowerCase', () => {
		test('lowercases entire string', () => {
			expect(toLowerCase('HELLO')).toBe('hello');
		});
	});
});
