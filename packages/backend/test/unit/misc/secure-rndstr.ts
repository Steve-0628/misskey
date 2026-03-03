process.env.NODE_ENV = 'test';

import { secureRndstr, L_CHARS } from '@/misc/secure-rndstr.js';

describe('secureRndstr', () => {
	test('returns a string of the requested length (default 32)', () => {
		expect(secureRndstr()).toHaveLength(32);
	});

	test('returns a string of the requested length when specified', () => {
		expect(secureRndstr(16)).toHaveLength(16);
	});

	test('returns a string of length 1', () => {
		expect(secureRndstr(1)).toHaveLength(1);
	});

	test('returns a string of length 64', () => {
		expect(secureRndstr(64)).toHaveLength(64);
	});

	test('default output contains only alphanumeric characters', () => {
		const result = secureRndstr(200);
		expect(result).toMatch(/^[0-9a-zA-Z]+$/);
	});

	test('output with L_CHARS contains only lowercase alphanumeric characters', () => {
		const result = secureRndstr(200, { chars: L_CHARS });
		expect(result).toMatch(/^[0-9a-z]+$/);
	});

	test('output with custom charset stays within that charset', () => {
		const chars = 'abc';
		const result = secureRndstr(200, { chars });
		expect(result).toMatch(/^[abc]+$/);
	});

	test('two consecutive calls produce different strings (probabilistic)', () => {
		const a = secureRndstr(32);
		const b = secureRndstr(32);
		expect(a).not.toBe(b);
	});
});
