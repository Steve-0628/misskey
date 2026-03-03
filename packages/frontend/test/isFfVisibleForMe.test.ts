import { describe, test, expect, vi } from 'vitest';
import { isFfVisibleForMe } from '@/scripts/isFfVisibleForMe';

vi.mock('@/account', () => ({
	$i: null,
}));

import * as account from '@/account';

function makeUser(overrides: Partial<{
	id: string;
	ffVisibility: 'public' | 'followers' | 'private';
	isFollowing: boolean;
}> = {}) {
	return {
		id: 'user-1',
		ffVisibility: 'public' as const,
		isFollowing: false,
		...overrides,
	} as any;
}

describe('isFfVisibleForMe', () => {
	test('returns true when ffVisibility is public', () => {
		(account as any).$i = null;
		expect(isFfVisibleForMe(makeUser({ ffVisibility: 'public' }))).toBe(true);
	});

	test('returns false when ffVisibility is private and viewer is not the user', () => {
		(account as any).$i = { id: 'viewer-1' };
		expect(isFfVisibleForMe(makeUser({ id: 'user-1', ffVisibility: 'private' }))).toBe(false);
	});

	test('returns true when ffVisibility is private but viewer is the user themselves', () => {
		(account as any).$i = { id: 'user-1' };
		expect(isFfVisibleForMe(makeUser({ id: 'user-1', ffVisibility: 'private' }))).toBe(true);
	});

	test('returns false when ffVisibility is followers and viewer is not following', () => {
		(account as any).$i = { id: 'viewer-1' };
		expect(isFfVisibleForMe(makeUser({ id: 'user-1', ffVisibility: 'followers', isFollowing: false }))).toBe(false);
	});

	test('returns true when ffVisibility is followers and viewer is following', () => {
		(account as any).$i = { id: 'viewer-1' };
		expect(isFfVisibleForMe(makeUser({ id: 'user-1', ffVisibility: 'followers', isFollowing: true }))).toBe(true);
	});

	test('returns true when no logged-in user and ffVisibility is public', () => {
		(account as any).$i = null;
		expect(isFfVisibleForMe(makeUser({ ffVisibility: 'public' }))).toBe(true);
	});
});
