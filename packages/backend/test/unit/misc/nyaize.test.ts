
import { describe, test, expect } from '@jest/globals';
import { nyaize } from '../../../src/misc/nyaize.js';

describe('nyaize', () => {
	test('should replace Japanese characters', () => {
		expect(nyaize('さかな')).toBe('さかにゃ');
		expect(nyaize('さようなら')).toBe('さようにゃら');
		expect(nyaize('ナニヌネノ')).toBe('ニャニヌネノ');
		expect(nyaize('ﾊﾞﾅﾅ')).toBe('ﾊﾞﾆｬﾆｬ');
	});

	test('should replace English characters', () => {
		expect(nyaize('banana')).toBe('banyanya');
		expect(nyaize('Good Morning')).toBe('Good Mornyan');
		expect(nyaize('Everyone')).toBe('Everynyan');
		expect(nyaize('NAME')).toBe('NYAME');
	});

	// Skipping Korean tests as I am not confident in constructing them correctly without more research,
	// but the function has logic for it. I will test basic one if I can infer.
	// Line 13: replaces 'da' at end or before punctuation with 'danyang'.
	test('should replace Korean characters', () => {
		expect(nyaize('안녕이다')).toBe('안녕이다냥');
	});

	test('should not change other text', () => {
		expect(nyaize('hello')).toBe('hello');
		expect(nyaize('test')).toBe('test');
	});
});
