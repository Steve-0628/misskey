process.env.NODE_ENV = 'test';

import { normalizeForSearch } from '@/misc/normalize-for-search.js';

describe('normalizeForSearch', () => {
	test('lowercases ASCII characters', () => {
		expect(normalizeForSearch('Hello')).toBe('hello');
	});

	test('lowercases all-uppercase strings', () => {
		expect(normalizeForSearch('MISSKEY')).toBe('misskey');
	});

	test('leaves already-lowercase strings unchanged', () => {
		expect(normalizeForSearch('misskey')).toBe('misskey');
	});

	test('applies NFKC normalization to fullwidth characters', () => {
		// Fullwidth latin 'Ａ' (U+FF21) → 'A' then lowercased → 'a'
		expect(normalizeForSearch('Ａ')).toBe('a');
	});

	test('applies NFKC normalization to halfwidth katakana', () => {
		// Half-width katakana ｱ (U+FF71) → full-width ア (U+30A2)
		expect(normalizeForSearch('ｱｲｳ')).toBe('アイウ');
	});

	test('decomposes ligatures via NFKC', () => {
		// ﬁ (U+FB01) → fi
		expect(normalizeForSearch('ﬁle')).toBe('file');
	});

	test('handles empty string', () => {
		expect(normalizeForSearch('')).toBe('');
	});

	test('handles strings with numbers and symbols unchanged', () => {
		expect(normalizeForSearch('tag123')).toBe('tag123');
	});

	test('normalizes superscript digits', () => {
		// ² (U+00B2) → NFKC → '2'
		expect(normalizeForSearch('x²')).toBe('x2');
	});
});
