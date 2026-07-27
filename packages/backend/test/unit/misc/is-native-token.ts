process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import isNativeToken from '@/misc/is-native-token.js';

describe('isNativeToken', () => {
	test('returns true for 16-character strings', () => {
		expect(isNativeToken('0123456789abcdef')).toBe(true);
		expect(isNativeToken('aaaaaaaaaaaaaaaa')).toBe(true);
	});

	test('returns false for non-16-character strings', () => {
		expect(isNativeToken('short')).toBe(false);
		expect(isNativeToken('0123456789abcdef0')).toBe(false);
		expect(isNativeToken('')).toBe(false);
	});
});
