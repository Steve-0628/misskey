process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import isQuote from '@/misc/is-quote.js';
import type { Note } from '@/models/entities/Note.js';

describe('isQuote', () => {
	const base = { renoteId: 'renote-id' } as Note;

	test('returns true when renote has text', () => {
		expect(isQuote({ ...base, text: 'hello' } as Note)).toBe(true);
	});

	test('returns true when renote has poll', () => {
		expect(isQuote({ ...base, text: null, hasPoll: true } as Note)).toBe(true);
	});

	test('returns true when renote has files', () => {
		expect(isQuote({ ...base, text: null, hasPoll: false, fileIds: ['a', 'b'] } as Note)).toBe(true);
	});

	test('returns false for pure renote without additions', () => {
		expect(isQuote({ ...base, text: null, hasPoll: false, fileIds: [] } as Note)).toBe(false);
	});

	test('returns false when renoteId is null', () => {
		expect(isQuote({ renoteId: null, text: 'hello' } as Note)).toBe(false);
	});
});
