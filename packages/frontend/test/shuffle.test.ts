import { describe, test, expect } from 'vitest';
import { shuffle } from '@/scripts/shuffle';

describe('shuffle', () => {
	test('returns the same array reference (mutates in place)', () => {
		const arr = [1, 2, 3, 4, 5];
		const result = shuffle(arr);
		expect(result).toBe(arr);
	});

	test('preserves all elements', () => {
		const arr = [1, 2, 3, 4, 5];
		const shuffled = shuffle([...arr]);
		expect(shuffled.sort()).toEqual(arr.sort());
	});

	test('returns empty array when given empty array', () => {
		expect(shuffle([])).toEqual([]);
	});

	test('returns single-element array unchanged', () => {
		expect(shuffle([42])).toEqual([42]);
	});

	test('preserves all string elements', () => {
		const arr = ['a', 'b', 'c', 'd'];
		const shuffled = shuffle([...arr]);
		expect(shuffled.sort()).toEqual(arr.sort());
	});

	test('has same length after shuffle', () => {
		const arr = [1, 2, 3, 4, 5, 6, 7, 8];
		expect(shuffle(arr).length).toBe(8);
	});
});
