import { describe, test, assert } from 'vitest';
import * as arrayUtils from '../src/scripts/array';

describe('array utils', () => {
	describe('countIf', () => {
		test('counts elements satisfying predicate', () => {
			assert.strictEqual(arrayUtils.countIf(x => x % 2 === 0, [1, 2, 3, 4, 5]), 2);
		});
	});

	describe('count', () => {
		test('counts specific element', () => {
			assert.strictEqual(arrayUtils.count(2, [1, 2, 3, 2, 1]), 2);
		});
	});

	describe('concat', () => {
		test('concatenates arrays', () => {
			assert.deepStrictEqual(arrayUtils.concat([[1, 2], [3], [4, 5]]), [1, 2, 3, 4, 5]);
		});
	});

	describe('intersperse', () => {
		test('intersperses separator', () => {
			assert.deepStrictEqual(arrayUtils.intersperse(0, [1, 2, 3]), [1, 0, 2, 0, 3]);
		});

		test('returns same array if length < 2', () => {
			assert.deepStrictEqual(arrayUtils.intersperse(0, [1]), [1]);
			assert.deepStrictEqual(arrayUtils.intersperse(0, []), []);
		});
	});

	describe('erase', () => {
		test('removes element', () => {
			assert.deepStrictEqual(arrayUtils.erase(2, [1, 2, 3, 2, 4]), [1, 3, 4]);
		});
	});

	describe('difference', () => {
		test('returns difference', () => {
			assert.deepStrictEqual(arrayUtils.difference([1, 2, 3, 4], [2, 4]), [1, 3]);
		});
	});

	describe('unique', () => {
		test('removes duplicates', () => {
			assert.deepStrictEqual(arrayUtils.unique([1, 2, 2, 3, 1]), [1, 2, 3]);
		});
	});

	describe('sum', () => {
		test('sums numbers', () => {
			assert.strictEqual(arrayUtils.sum([1, 2, 3]), 6);
		});
	});

	describe('maximum', () => {
		test('finds maximum', () => {
			assert.strictEqual(arrayUtils.maximum([1, 5, 2, 4]), 5);
		});
	});

	describe('lessThan', () => {
		test('compares arrays lexicographically', () => {
			assert.isTrue(arrayUtils.lessThan([1, 2, 3], [1, 2, 4]));
			assert.isTrue(arrayUtils.lessThan([1, 2], [1, 2, 3]));
			assert.isFalse(arrayUtils.lessThan([1, 2, 3], [1, 2, 3]));
			assert.isFalse(arrayUtils.lessThan([1, 2, 4], [1, 2, 3]));
		});
	});
});
