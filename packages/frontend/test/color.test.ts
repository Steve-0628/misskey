import { describe, test, assert } from 'vitest';
import { alpha } from '../src/scripts/color';

describe('color utils', () => {
	describe('alpha', () => {
		test('converts hex to rgba with alpha', () => {
			assert.strictEqual(alpha('#000000', 0.5), 'rgba(0, 0, 0, 0.5)');
			assert.strictEqual(alpha('#ffffff', 1), 'rgba(255, 255, 255, 1)');
			assert.strictEqual(alpha('#ff0000', 0), 'rgba(255, 0, 0, 0)');
		});

		test('handles uppercase hex', () => {
			assert.strictEqual(alpha('#FF0000', 1), 'rgba(255, 0, 0, 1)');
		});

		test('handles hex without hash', () => {
			assert.strictEqual(alpha('00ff00', 1), 'rgba(0, 255, 0, 1)');
		});
	});
});
