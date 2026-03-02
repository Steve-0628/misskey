import { describe, test, assert } from 'vitest';
import numberFilter from '../src/filters/number';

describe('number filter', () => {
	test('formats numbers', () => {
		assert.strictEqual(numberFilter(0), '0');
		assert.strictEqual(numberFilter(1000), '1,000');
		assert.strictEqual(numberFilter(1234567), '1,234,567');
	});

	test('handles null/undefined', () => {
		assert.strictEqual(numberFilter(null), 'N/A');
		assert.strictEqual(numberFilter(undefined), 'N/A');
	});
});
