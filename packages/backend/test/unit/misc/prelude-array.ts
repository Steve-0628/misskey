process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import {
	countIf,
	count,
	concat,
	intersperse,
	erase,
	difference,
	unique,
	sum,
	maximum,
	groupBy,
	groupOn,
	groupByX,
	lessThan,
	takeWhile,
	cumulativeSum,
	toArray,
	toSingle,
} from '@/misc/prelude/array.js';

describe('prelude/array', () => {
	describe('countIf', () => {
		test('counts elements matching predicate', () => {
			expect(countIf(x => x > 0, [-1, 0, 1, 2])).toBe(2);
		});

		test('returns 0 for empty array', () => {
			expect(countIf(() => true, [])).toBe(0);
		});
	});

	describe('count', () => {
		test('counts occurrences of a value', () => {
			expect(count('a', ['a', 'b', 'a', 'c', 'a'])).toBe(3);
		});

		test('returns 0 when value is absent', () => {
			expect(count('z', ['a', 'b', 'c'])).toBe(0);
		});
	});

	describe('concat', () => {
		test('flattens one level of nested arrays', () => {
			expect(concat([[1, 2], [3], [4, 5]])).toEqual([1, 2, 3, 4, 5]);
		});

		test('returns empty array for empty input', () => {
			expect(concat([])).toEqual([]);
		});
	});

	describe('intersperse', () => {
		test('places separator between elements', () => {
			expect(intersperse(0, [1, 2, 3])).toEqual([1, 0, 2, 0, 3]);
		});

		test('returns single element unchanged', () => {
			expect(intersperse(0, [1])).toEqual([1]);
		});

		test('returns empty array for empty input', () => {
			expect(intersperse(0, [])).toEqual([]);
		});
	});

	describe('erase', () => {
		test('removes all occurrences of value', () => {
			expect(erase(2, [1, 2, 3, 2, 4])).toEqual([1, 3, 4]);
		});

		test('returns empty array when all values match', () => {
			expect(erase('x', ['x', 'x'])).toEqual([]);
		});
	});

	describe('difference', () => {
		test('returns elements in first array not in second', () => {
			expect(difference([1, 2, 3, 4], [2, 4])).toEqual([1, 3]);
		});

		test('preserves order of first array', () => {
			expect(difference(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
		});
	});

	describe('unique', () => {
		test('removes duplicate primitives', () => {
			expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
		});
	});

	describe('sum', () => {
		test('sums numbers', () => {
			expect(sum([1, 2, 3, 4])).toBe(10);
		});

		test('returns 0 for empty array', () => {
			expect(sum([])).toBe(0);
		});
	});

	describe('maximum', () => {
		test('returns largest number', () => {
			expect(maximum([3, 1, 4, 1, 5])).toBe(5);
		});
	});

	describe('groupBy', () => {
		test('groups consecutive equal elements by relation', () => {
			expect(groupBy((a, b) => a === b, [1, 1, 2, 2, 1])).toEqual([[1, 1], [2, 2], [1]]);
		});

		test('returns singleton groups for all-different input', () => {
			expect(groupBy(() => false, [1, 2, 3])).toEqual([[1], [2], [3]]);
		});
	});

	describe('groupOn', () => {
		test('groups consecutive elements by key function', () => {
			expect(groupOn(x => x.length, ['a', 'b', 'cc', 'dd', 'e'])).toEqual([['a', 'b'], ['cc', 'dd'], ['e']]);
		});
	});

	describe('groupByX', () => {
		test('groups into object keyed by selector', () => {
			expect(groupByX(['a', 'b', 'cc', 'dd', 'e'], x => String(x.length))).toEqual({
				'1': ['a', 'b', 'e'],
				'2': ['cc', 'dd'],
			});
		});
	});

	describe('lessThan', () => {
		test('compares arrays lexicographically', () => {
			expect(lessThan([1, 2], [1, 3])).toBe(true);
			expect(lessThan([1, 3], [1, 2])).toBe(false);
			expect(lessThan([1, 2], [1, 2])).toBe(false);
			expect(lessThan([1, 2], [1, 2, 3])).toBe(true);
			expect(lessThan([1, 2, 3], [1, 2])).toBe(false);
		});
	});

	describe('takeWhile', () => {
		test('returns longest matching prefix', () => {
			expect(takeWhile(x => x < 3, [1, 2, 3, 4])).toEqual([1, 2]);
		});

		test('returns all elements when predicate always true', () => {
			expect(takeWhile(() => true, [1, 2, 3])).toEqual([1, 2, 3]);
		});
	});

	describe('cumulativeSum', () => {
		test('computes running totals', () => {
			expect(cumulativeSum([1, 2, 3, 4])).toEqual([1, 3, 6, 10]);
		});

		test('does not mutate input', () => {
			const xs = [1, 2, 3];
			const ys = cumulativeSum(xs);
			expect(xs).toEqual([1, 2, 3]);
			expect(ys).not.toBe(xs);
		});
	});

	describe('toArray', () => {
		test('wraps single value', () => {
			expect(toArray(1)).toEqual([1]);
		});

		test('returns array unchanged', () => {
			expect(toArray([1, 2])).toEqual([1, 2]);
		});

		test('returns empty array for undefined', () => {
			expect(toArray(undefined)).toEqual([]);
		});
	});

	describe('toSingle', () => {
		test('returns single value', () => {
			expect(toSingle(1)).toBe(1);
		});

		test('returns first element of array', () => {
			expect(toSingle([1, 2, 3])).toBe(1);
		});

		test('returns undefined for undefined', () => {
			expect(toSingle(undefined)).toBeUndefined();
		});
	});
});
