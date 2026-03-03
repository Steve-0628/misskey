import { describe, test, expect } from 'vitest';
import { safeURIDecode } from '@/scripts/safe-uri-decode';

describe('safeURIDecode', () => {
	test('decodes a valid percent-encoded string', () => {
		expect(safeURIDecode('hello%20world')).toBe('hello world');
	});

	test('decodes a URL with encoded special characters', () => {
		expect(safeURIDecode('foo%3Dbar%26baz%3D1')).toBe('foo=bar&baz=1');
	});

	test('returns the original string when decoding fails', () => {
		// %ZZ is not valid percent-encoding
		expect(safeURIDecode('%ZZ')).toBe('%ZZ');
	});

	test('returns an empty string unchanged', () => {
		expect(safeURIDecode('')).toBe('');
	});

	test('leaves a plain string unchanged', () => {
		expect(safeURIDecode('hello')).toBe('hello');
	});

	test('decodes Japanese characters', () => {
		// "テスト" encoded
		const encoded = encodeURIComponent('テスト');
		expect(safeURIDecode(encoded)).toBe('テスト');
	});

	test('handles string with % at end (invalid) gracefully', () => {
		expect(safeURIDecode('abc%')).toBe('abc%');
	});
});
