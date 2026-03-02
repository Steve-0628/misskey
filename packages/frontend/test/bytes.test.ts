import { describe, test, assert } from 'vitest';
import bytes from '../src/filters/bytes';

describe('bytes filter', () => {
	test('formats bytes', () => {
		assert.strictEqual(bytes(0), '0');
		assert.strictEqual(bytes(10), '10B');
		assert.strictEqual(bytes(1024), '1KB');
		assert.strictEqual(bytes(1024 * 1024), '1MB');
		assert.strictEqual(bytes(1024 * 1024 * 1024), '1GB');
	});

	test('formats with digits', () => {
		assert.strictEqual(bytes(1500, 1), '1.5KB');
	});

	test('handles negative values', () => {
		assert.strictEqual(bytes(-1024), '-1KB');
	});

	test('handles null/undefined', () => {
		assert.strictEqual(bytes(null), '?');
		assert.strictEqual(bytes(undefined), '?');
	});
});
