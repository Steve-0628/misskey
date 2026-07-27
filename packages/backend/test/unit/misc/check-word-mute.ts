process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { checkWordMute } from '@/misc/check-word-mute.js';

describe('checkWordMute', () => {
	test('returns false for own note', async () => {
		const result = await checkWordMute({ userId: 'me', text: 'bad' }, { id: 'me' }, [['bad']]);
		expect(result).toBe(false);
	});

	test('returns false when no muted words', async () => {
		const result = await checkWordMute({ userId: 'other', text: 'hello' }, { id: 'me' }, []);
		expect(result).toBe(false);
	});

	test('returns false when text is empty', async () => {
		const result = await checkWordMute({ userId: 'other', text: null }, { id: 'me' }, [['bad']]);
		expect(result).toBe(false);
	});

	test('matches single keyword via AhoCorasick', async () => {
		const result = await checkWordMute({ userId: 'other', text: 'hello bad world' }, { id: 'me' }, [['bad']]);
		expect(result).toBe(true);
	});

	test('matches multiple keywords via AND', async () => {
		const result = await checkWordMute({ userId: 'other', text: 'hello bad world' }, { id: 'me' }, [['bad', 'world']]);
		expect(result).toBe(true);
	});

	test('returns false when AND keywords not all present', async () => {
		const result = await checkWordMute({ userId: 'other', text: 'hello bad' }, { id: 'me' }, [['bad', 'world']]);
		expect(result).toBe(false);
	});

	test('matches regexp', async () => {
		const result = await checkWordMute({ userId: 'other', text: 'hello world' }, { id: 'me' }, ['/wor.+/']);
		expect(result).toBe(true);
	});

	test('ignores invalid regexp string', async () => {
		const result = await checkWordMute({ userId: 'other', text: 'hello' }, { id: 'me' }, ['invalid']);
		expect(result).toBe(false);
	});

	test('matches cw text', async () => {
		const result = await checkWordMute({ userId: 'other', text: 'hello', cw: 'bad cw' }, { id: 'me' }, [['cw']]);
		expect(result).toBe(true);
	});
});
