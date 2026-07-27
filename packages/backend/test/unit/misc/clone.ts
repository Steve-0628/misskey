process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { deepClone } from '@/misc/clone.js';

describe('deepClone', () => {
	test('returns primitives unchanged', () => {
		expect(deepClone('hello')).toBe('hello');
		expect(deepClone(42)).toBe(42);
		expect(deepClone(true)).toBe(true);
		expect(deepClone(null)).toBeNull();
	});

	test('clones arrays deeply', () => {
		const arr = [[1, 2], [3, 4]];
		const cloned = deepClone(arr);
		expect(cloned).toEqual(arr);
		expect(cloned).not.toBe(arr);
		expect(cloned[0]).not.toBe(arr[0]);
	});

	test('clones objects deeply', () => {
		const obj = { a: 1, nested: { b: 2, c: [3, 4] } };
		const cloned = deepClone(obj);
		expect(cloned).toEqual(obj);
		expect(cloned).not.toBe(obj);
		expect(cloned.nested).not.toBe(obj.nested);
		expect(cloned.nested.c).not.toBe(obj.nested.c);
	});

	test('modifying clone does not affect original', () => {
		const obj = { a: { b: 1 } };
		const cloned = deepClone(obj);
		cloned.a.b = 2;
		expect(obj.a.b).toBe(1);
	});

	test('handles empty structures', () => {
		expect(deepClone({})).toEqual({});
		expect(deepClone([])).toEqual([]);
	});
});
