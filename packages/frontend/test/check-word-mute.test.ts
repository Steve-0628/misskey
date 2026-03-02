import { describe, test, assert } from 'vitest';
import { checkWordMute } from '../src/scripts/check-word-mute';

describe('checkWordMute', () => {
	const me = { id: 'me' };
	const otherUser = { id: 'other' };

	test('returns false if note is from self', () => {
		const note = { userId: 'me', text: 'bad word' };
		assert.isFalse(checkWordMute(note, me, [['bad result']]));
	});

	test('returns false if no muted words', () => {
		const note = { userId: 'other', text: 'hello' };
		assert.isFalse(checkWordMute(note, me, []));
	});

	test('mutes by simple keyword (AND logic in array)', () => {
		const note = { userId: 'other', text: 'this is a bad word' };
		// ['bad', 'word'] means "bad" AND "word" must be present
		assert.isTrue(checkWordMute(note, me, [['bad', 'word']]));
	});

	test('does not mute if only some keywords match (AND logic)', () => {
		const note = { userId: 'other', text: 'this is a bad thing' };
		// ['bad', 'word'] -> "bad" is present, "word" is not
		assert.isFalse(checkWordMute(note, me, [['bad', 'word']]));
	});

	test('mutes by regexp', () => {
		const note = { userId: 'other', text: 'foobar' };
		// Regexp format: /pattern/flags
		assert.isTrue(checkWordMute(note, me, ['/foo/']));
	});

	test('checks cw content', () => {
		const note = { userId: 'other', cw: 'warning: bad content', text: 'safe content' };
		assert.isTrue(checkWordMute(note, me, [['bad']]));
	});

	test('ignores empty strings in filter', () => {
		const note = { userId: 'other', text: 'hello' };
		// [['']] or similar
		assert.isFalse(checkWordMute(note, me, [['']]));
	});

	test('handles invalid regexp gracefully', () => {
		const note = { userId: 'other', text: 'hello' };
		// Invalid regexp syntax might be caught or ignored
		// The code expects /.../ format strictly, otherwise ignores or throws/catches.
		// If input is not in /.../ format, it enters array block? No, code:
		// if (Array.isArray(filter)) ... else ... regexp.match(...)
		// If match returns null, returns false.
		assert.isFalse(checkWordMute(note, me, ['invalid']));
	});
});
