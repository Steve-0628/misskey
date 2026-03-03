process.env.NODE_ENV = 'test';

import * as s from '@/misc/prelude/string.js';

describe('prelude/string', () => {
	test('concat', () => {
		expect(s.concat(['a', 'b', 'c'])).toBe('abc');
	});

	test('capitalize and case functions', () => {
		expect(s.capitalize('hello')).toBe('Hello');
		expect(s.toUpperCase('aBc')).toBe('ABC');
		expect(s.toLowerCase('aBc')).toBe('abc');
	});
});
