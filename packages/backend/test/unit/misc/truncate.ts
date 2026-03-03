process.env.NODE_ENV = 'test';

import { truncate } from '@/misc/truncate.js';

describe('truncate', () => {
	test('returns undefined when input is undefined', () => {
		expect(truncate(undefined, 10)).toBeUndefined();
	});

	test('returns empty string when input is empty string', () => {
		expect(truncate('', 10)).toBe('');
	});

	test('returns string unchanged when shorter than size', () => {
		expect(truncate('hello', 10)).toBe('hello');
	});

	test('returns string unchanged when equal to size', () => {
		expect(truncate('hello', 5)).toBe('hello');
	});

	test('truncates string longer than size', () => {
		expect(truncate('hello world', 5)).toBe('hello');
	});

	test('truncates at Unicode code point boundary, not byte boundary', () => {
		const emoji = '😀';
		const str = emoji + 'abc';
		expect(truncate(str, 1)).toBe(emoji);
	});

	test('handles multi-codepoint emoji correctly', () => {
		const flag = '🇯🇵';
		expect(truncate(flag + 'abc', 1)).toBe(flag);
	});

	test('handles size of 0', () => {
		expect(truncate('hello', 0)).toBe('');
	});

	test('handles string with only emoji', () => {
		const str = '😀😁😂';
		expect(truncate(str, 2)).toBe('😀😁');
	});

	test('handles Japanese characters', () => {
		expect(truncate('あいうえお', 3)).toBe('あいう');
	});
});
