process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { awaitAll } from '@/misc/prelude/await-all.js';

describe('prelude/await-all', () => {
	test('resolves plain values', async () => {
		const result = await awaitAll({ a: 1, b: 'two' });
		expect(result).toEqual({ a: 1, b: 'two' });
	});

	test('resolves promises at top level', async () => {
		const result = await awaitAll({ a: Promise.resolve(1), b: Promise.resolve('two') });
		expect(result).toEqual({ a: 1, b: 'two' });
	});

	test('recursively resolves nested objects', async () => {
		const result = await awaitAll({
			outer: {
				inner: Promise.resolve('deep'),
			},
		});
		expect(result).toEqual({ outer: { inner: 'deep' } });
	});

	test('handles mixed plain values and promises', async () => {
		const result = await awaitAll({
			sync: 'sync',
			async: Promise.resolve('async'),
			nested: {
				sync: 42,
				async: Promise.resolve(99),
			},
		});
		expect(result).toEqual({
			sync: 'sync',
			async: 'async',
			nested: {
				sync: 42,
				async: 99,
			},
		});
	});

	test('does not recurse into arrays', async () => {
		const result = await awaitAll({ items: [Promise.resolve(1), Promise.resolve(2)] });
		expect(Array.isArray(result.items)).toBe(true);
		// Arrays are passed through unchanged (the constructor name is Array, not Object)
		expect(result.items[0]).toBeInstanceOf(Promise);
	});

	test('resolves in parallel', async () => {
		const order: string[] = [];
		const p1 = new Promise<void>(resolve => setTimeout(() => { order.push('p1'); resolve(); }, 30));
		const p2 = new Promise<void>(resolve => setTimeout(() => { order.push('p2'); resolve(); }, 10));
		await awaitAll({ p1, p2 });
		expect(order).toEqual(['p2', 'p1']);
	});
});
