process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { isUserRelated } from '@/misc/is-user-related.js';

describe('isUserRelated', () => {
	test('returns true when note userId is in set', () => {
		expect(isUserRelated({ userId: 'user1' }, new Set(['user1']))).toBe(true);
	});

	test('returns true when reply userId is in set', () => {
		expect(isUserRelated({ userId: 'user2', reply: { userId: 'user1' } }, new Set(['user1']))).toBe(true);
	});

	test('returns true when renote userId is in set', () => {
		expect(isUserRelated({ userId: 'user2', renote: { userId: 'user1' } }, new Set(['user1']))).toBe(true);
	});

	test('returns false when no userId matches', () => {
		expect(isUserRelated({ userId: 'user2', reply: { userId: 'user3' }, renote: { userId: 'user4' } }, new Set(['user1']))).toBe(false);
	});
});
