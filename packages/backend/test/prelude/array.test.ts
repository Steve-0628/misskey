process.env.NODE_ENV = 'test';

import * as arr from '@/misc/prelude/array.js';

describe('prelude/array', () => {
	test('countIf and count', () => {
		const xs = [1, 2, 2, 3];
		expect(arr.countIf(x => x === 2, xs)).toBe(2);
		expect(arr.count(2, xs)).toBe(2);
	});

	test('concat and intersperse', () => {
		expect(arr.concat([[1, 2], [3]])).toEqual([1, 2, 3]);
		expect(arr.intersperse(0, [1, 2, 3])).toEqual([1, 0, 2, 0, 3]);
	});

	test('erase and difference and unique', () => {
		expect(arr.erase(2, [1, 2, 3, 2])).toEqual([1, 3]);
		expect(arr.difference([1, 2, 3], [2, 4])).toEqual([1, 3]);
		expect(arr.unique([1, 1, 2, 2, 3])).toEqual([1, 2, 3]);
	});

	test('sum and maximum', () => {
		expect(arr.sum([1, 2, 3])).toBe(6);
		expect(arr.maximum([1, 5, 3])).toBe(5);
	});

	test('groupBy and groupOn', () => {
		const xs = [1, 1, 2, 2, 3];
		const groups = arr.groupBy((a, b) => a === b, xs);
		expect(groups).toEqual([[1, 1], [2, 2], [3]]);
		expect(arr.groupOn(x => x % 2, [1, 3, 2, 4])).toEqual([[1, 3], [2, 4]]);
	});

	test('groupByX', () => {
		const collections = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'a', v: 3 }];
		const grouped = arr.groupByX(collections, x => x.id);
		expect(grouped['a']).toHaveLength(2);
		expect(grouped['b']).toHaveLength(1);
	});

	test('lessThan and takeWhile', () => {
		expect(arr.lessThan([1, 2], [1, 3])).toBe(true);
		expect(arr.lessThan([1, 2, 3], [1, 2])).toBe(false);
		expect(arr.takeWhile(x => x < 3, [1, 2, 3, 4])).toEqual([1, 2]);
	});

	test('cumulativeSum, toArray, toSingle', () => {
		expect(arr.cumulativeSum([1, 2, 3])).toEqual([1, 3, 6]);
		expect(arr.toArray(1)).toEqual([1]);
		expect(arr.toArray([1, 2])).toEqual([1, 2]);
		expect(arr.toArray(undefined)).toEqual([]);
		expect(arr.toSingle([5, 6])).toBe(5);
		expect(arr.toSingle(7)).toBe(7);
	});
});
