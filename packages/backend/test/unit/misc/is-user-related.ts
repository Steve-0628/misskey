process.env.NODE_ENV = 'test';

import { isUserRelated } from '@/misc/is-user-related.js';

describe('isUserRelated', () => {
	test('returns true when the note author is in the set', () => {
		const note = { userId: 'user1' };
		expect(isUserRelated(note, new Set(['user1']))).toBe(true);
	});

	test('returns false when the note author is not in the set', () => {
		const note = { userId: 'user1' };
		expect(isUserRelated(note, new Set(['user2']))).toBe(false);
	});

	test('returns false for an empty set', () => {
		const note = { userId: 'user1' };
		expect(isUserRelated(note, new Set())).toBe(false);
	});

	test('returns true when the reply author is in the set', () => {
		const note = { userId: 'user1', reply: { userId: 'user2' } };
		expect(isUserRelated(note, new Set(['user2']))).toBe(true);
	});

	test('returns true when the renote author is in the set', () => {
		const note = { userId: 'user1', renote: { userId: 'user3' } };
		expect(isUserRelated(note, new Set(['user3']))).toBe(true);
	});

	test('returns false when neither note, reply, nor renote author is in the set', () => {
		const note = { userId: 'user1', reply: { userId: 'user2' }, renote: { userId: 'user3' } };
		expect(isUserRelated(note, new Set(['user4']))).toBe(false);
	});

	test('returns false when note has no reply or renote and author is not in set', () => {
		const note = { userId: 'user1' };
		expect(isUserRelated(note, new Set(['user2', 'user3']))).toBe(false);
	});

	test('returns true when multiple users are in set and note author matches', () => {
		const note = { userId: 'user1' };
		expect(isUserRelated(note, new Set(['user1', 'user2']))).toBe(true);
	});

	test('handles null reply gracefully', () => {
		const note = { userId: 'user1', reply: null };
		expect(isUserRelated(note, new Set(['user1']))).toBe(true);
	});

	test('handles null renote gracefully', () => {
		const note = { userId: 'user1', renote: null };
		expect(isUserRelated(note, new Set(['user1']))).toBe(true);
	});
});
