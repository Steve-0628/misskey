process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { checkHttps } from '@/misc/check-https.js';

describe('checkHttps', () => {
	test('returns true for https URLs', () => {
		expect(checkHttps('https://example.com')).toBe(true);
		expect(checkHttps('https://example.com/path?q=1')).toBe(true);
	});

	test('returns true for http URLs in non-production', () => {
		expect(checkHttps('http://example.com')).toBe(true);
	});

	test('returns false for http URLs in production', () => {
		const original = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production';
		try {
			expect(checkHttps('http://example.com')).toBe(false);
		} finally {
			process.env.NODE_ENV = original;
		}
	});

	test('returns false for non-http schemes', () => {
		expect(checkHttps('ftp://example.com')).toBe(false);
		expect(checkHttps('javascript:alert(1)')).toBe(false);
		expect(checkHttps('')).toBe(false);
	});
});
