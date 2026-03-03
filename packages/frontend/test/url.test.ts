import { describe, test, expect } from 'vitest';
import { query, appendQuery } from '@/scripts/url';

describe('query', () => {
	test('builds a query string from an object', () => {
		expect(query({ a: '1', b: '2' })).toBe('a=1&b=2');
	});

	test('URL-encodes values', () => {
		const result = query({ url: 'https://example.com/path?x=1' });
		expect(result).toBe('url=' + encodeURIComponent('https://example.com/path?x=1'));
	});

	test('omits undefined values', () => {
		expect(query({ a: '1', b: undefined })).toBe('a=1');
	});

	test('omits empty arrays', () => {
		expect(query({ a: '1', arr: [] })).toBe('a=1');
	});

	test('includes non-empty arrays', () => {
		const result = query({ arr: ['x'] });
		expect(result).toContain('arr=');
	});

	test('returns empty string for empty object', () => {
		expect(query({})).toBe('');
	});

	test('returns empty string when all values are undefined', () => {
		expect(query({ a: undefined, b: undefined })).toBe('');
	});
});

describe('appendQuery', () => {
	test('appends query to URL with no existing query', () => {
		expect(appendQuery('https://example.com', 'a=1')).toBe('https://example.com?a=1');
	});

	test('appends query to URL that already has a query string', () => {
		expect(appendQuery('https://example.com?x=1', 'a=2')).toBe('https://example.com?x=1&a=2');
	});

	test('appends without extra ? when URL ends with ?', () => {
		expect(appendQuery('https://example.com?', 'a=1')).toBe('https://example.com?a=1');
	});

	test('handles path-only URLs', () => {
		expect(appendQuery('/path', 'q=test')).toBe('/path?q=test');
	});
});
