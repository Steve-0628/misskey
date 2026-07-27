process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import getReactionEmoji from '@/misc/get-reaction-emoji.js';

describe('getReactionEmoji', () => {
	test.each([
		['like', '👍'],
		['love', '❤️'],
		['laugh', '😆'],
		['hmm', '🤔'],
		['surprise', '😮'],
		['congrats', '🎉'],
		['angry', '💢'],
		['confused', '😥'],
		['rip', '😇'],
		['pudding', '🍮'],
		['star', '⭐'],
	])('maps %s to %s', (input, expected) => {
		expect(getReactionEmoji(input)).toBe(expected);
	});

	test('returns unknown reaction as-is', () => {
		expect(getReactionEmoji('custom')).toBe('custom');
	});
});
