process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { query, appendQuery } from '@/misc/prelude/url.js';

describe('prelude/url', () => {
	describe('query', () => {
		test('builds query string from object', () => {
			expect(query({ a: 'foo', b: 'bar' })).toBe('a=foo&b=bar');
		});

		test('encodes values', () => {
			expect(query({ q: 'hello world' })).toBe('q=hello%20world');
			expect(query({ special: '&=?' })).toBe('special=%26%3D%3F');
		});

		test('omits undefined values', () => {
			expect(query({ a: 'foo', b: undefined, c: 'bar' })).toBe('a=foo&c=bar');
		});

		test('omits empty arrays', () => {
			expect(query({ a: 'foo', b: [] })).toBe('a=foo');
		});

		test('includes non-empty arrays', () => {
			expect(query({ a: ['foo', 'bar'] })).toBe('a=foo%2Cbar');
		});

		test('returns empty string for empty object', () => {
			expect(query({})).toBe('');
		});
	});

	describe('appendQuery', () => {
		test('adds query to bare url', () => {
			expect(appendQuery('https://example.com', 'a=1')).toBe('https://example.com?a=1');
		});

		test('appends with ampersand when query already exists', () => {
			expect(appendQuery('https://example.com?a=1', 'b=2')).toBe('https://example.com?a=1&b=2');
		});

		test('does not add extra ampersand after trailing question mark', () => {
			expect(appendQuery('https://example.com?', 'a=1')).toBe('https://example.com?a=1');
		});
	});
});
