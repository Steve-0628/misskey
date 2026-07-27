process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { escapeValue, escapeAttribute } from '@/misc/prelude/xml.js';

describe('prelude/xml', () => {
	describe('escapeValue', () => {
		test('escapes XML special characters outside CDATA', () => {
			expect(escapeValue('a & b < c > d " e \' f')).toBe('a &amp; b &lt; c &gt; d &quot; e &apos; f');
		});

		test('does not escape content inside CDATA section and strips markers', () => {
			expect(escapeValue('<![CDATA[<raw> & "\' ]]>'))
				.toBe('<raw> & "\' ');
		});

		test('escapes text outside but preserves unescaped content inside CDATA', () => {
			const input = 'before <![CDATA[<raw>]]> after &';
			expect(escapeValue(input)).toBe('before <raw> after &amp;');
		});

		test('returns empty string for empty input', () => {
			expect(escapeValue('')).toBe('');
		});
	});

	describe('escapeAttribute', () => {
		test('escapes XML special characters', () => {
			expect(escapeAttribute('a & b < c > d " e \' f')).toBe('a &amp; b &lt; c &gt; d &quot; e &apos; f');
		});

		test('returns empty string for empty input', () => {
			expect(escapeAttribute('')).toBe('');
		});
	});
});
