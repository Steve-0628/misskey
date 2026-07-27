process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { fallback } from '@/misc/prelude/symbol.js';

describe('prelude/symbol', () => {
	test('fallback is a unique symbol', () => {
		expect(typeof fallback).toBe('symbol');
		expect(fallback).not.toBe(Symbol('fallback'));
	});
});
