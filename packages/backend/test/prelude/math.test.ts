process.env.NODE_ENV = 'test';

import { gcd } from '@/misc/prelude/math.js';

describe('prelude/math', () => {
	test('gcd basic', () => {
		expect(gcd(12, 8)).toBe(4);
		expect(gcd(7, 3)).toBe(1);
		expect(gcd(100, 10)).toBe(10);
	});

	test('gcd with zero', () => {
		expect(gcd(5, 0)).toBe(5);
		expect(gcd(0, 7)).toBe(7);
	});
});
