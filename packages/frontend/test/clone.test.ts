import { describe, test, assert } from 'vitest';
import { deepClone } from '../src/scripts/clone';

describe('deepClone', () => {
	test('clones object deeply', () => {
		const original = {
			a: 1,
			b: {
				c: 2,
			},
		};
		const cloned = deepClone(original);

		assert.deepEqual(cloned, original);
		assert.notStrictEqual(cloned, original);
		assert.notStrictEqual(cloned.b, original.b);
	});

	test('clones array deeply', () => {
		const original = [1, { a: 2 }];
		const cloned = deepClone(original);

		assert.deepEqual(cloned, original);
		assert.notStrictEqual(cloned, original);
		assert.notStrictEqual(cloned[1], original[1]);
	});

	test('handles primitive values', () => {
		assert.strictEqual(deepClone(1), 1);
		assert.strictEqual(deepClone('a'), 'a');
		assert.strictEqual(deepClone(true), true);
		assert.strictEqual(deepClone(null), null);
	});
});
