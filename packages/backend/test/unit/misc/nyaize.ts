process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { nyaize } from '@/misc/nyaize.js';

describe('nyaize', () => {
	test('nyaizes Japanese na syllables', () => {
		expect(nyaize('な')).toBe('にゃ');
		expect(nyaize('ナ')).toBe('ニャ');
		expect(nyaize('ﾅ')).toBe('ﾆｬ');
	});

	test('nyaizes English words', () => {
		expect(nyaize('na')).toBe('nya');
		expect(nyaize('NA')).toBe('NYA');
		expect(nyaize('morning')).toBe('mornyan');
		expect(nyaize('Morning')).toBe('Mornyan');
		expect(nyaize('everyone')).toBe('everynyan');
		expect(nyaize('Everyone')).toBe('Everynyan');
	});

	test('nyaizes Korean characters', () => {
		expect(nyaize('나')).toBe('냐');
		expect(nyaize('낳')).toBe('냫');
	});

	test('nyaizes Korean sentence endings', () => {
		expect(nyaize('하다')).toBe('하다냥');
		expect(nyaize('하다.')).toBe('하다냥.');
		expect(nyaize('하다 ')).toBe('하다냥 ');
		expect(nyaize('하다!')).toBe('하다냥!');
		expect(nyaize('하다?')).toBe('하다냥?');
	});

	test('nyaizes Korean ya endings', () => {
		expect(nyaize('야')).toBe('냥');
		expect(nyaize('야?')).toBe('냥?');
		expect(nyaize('야 ')).toBe('냥 ');
	});
});
