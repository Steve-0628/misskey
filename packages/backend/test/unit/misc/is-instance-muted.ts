process.env.NODE_ENV = 'test';

import { isInstanceMuted, isUserFromMutedInstance } from '@/misc/is-instance-muted.js';
import type { Packed } from '@/misc/json-schema.js';

type MinimalNote = Pick<Packed<'Note'>, 'user'> & {
	reply?: { user: { host: string | null } } | null;
	renote?: { user: { host: string | null } } | null;
};

describe('isInstanceMuted', () => {
	test('returns true when the note author host is muted', () => {
		const note = { user: { host: 'evil.example' } } as MinimalNote as Packed<'Note'>;
		expect(isInstanceMuted(note, new Set(['evil.example']))).toBe(true);
	});

	test('returns false when the note author host is not muted', () => {
		const note = { user: { host: 'good.example' } } as MinimalNote as Packed<'Note'>;
		expect(isInstanceMuted(note, new Set(['evil.example']))).toBe(false);
	});

	test('returns true for a local note (null host) when empty string is muted', () => {
		const note = { user: { host: null } } as MinimalNote as Packed<'Note'>;
		expect(isInstanceMuted(note, new Set(['']))).toBe(true);
	});

	test('returns false for a local note when empty string is not muted', () => {
		const note = { user: { host: null } } as MinimalNote as Packed<'Note'>;
		expect(isInstanceMuted(note, new Set(['evil.example']))).toBe(false);
	});

	test('returns true when the reply author host is muted', () => {
		const note = {
			user: { host: 'good.example' },
			reply: { user: { host: 'evil.example' } },
		} as MinimalNote as Packed<'Note'>;
		expect(isInstanceMuted(note, new Set(['evil.example']))).toBe(true);
	});

	test('returns true when the renote author host is muted', () => {
		const note = {
			user: { host: 'good.example' },
			renote: { user: { host: 'evil.example' } },
		} as MinimalNote as Packed<'Note'>;
		expect(isInstanceMuted(note, new Set(['evil.example']))).toBe(true);
	});

	test('returns false when no involved host is muted', () => {
		const note = {
			user: { host: 'good.example' },
			reply: { user: { host: 'also-good.example' } },
			renote: { user: { host: 'still-good.example' } },
		} as MinimalNote as Packed<'Note'>;
		expect(isInstanceMuted(note, new Set(['evil.example']))).toBe(false);
	});

	test('returns false for an empty muted set', () => {
		const note = { user: { host: 'some.example' } } as MinimalNote as Packed<'Note'>;
		expect(isInstanceMuted(note, new Set())).toBe(false);
	});
});

describe('isUserFromMutedInstance', () => {
	test('returns true when the notification user host is muted', () => {
		const notif = { user: { host: 'evil.example' } } as Packed<'Notification'>;
		expect(isUserFromMutedInstance(notif, new Set(['evil.example']))).toBe(true);
	});

	test('returns false when the notification user host is not muted', () => {
		const notif = { user: { host: 'good.example' } } as Packed<'Notification'>;
		expect(isUserFromMutedInstance(notif, new Set(['evil.example']))).toBe(false);
	});

	test('returns true for a local notification user (null host) when empty string is muted', () => {
		const notif = { user: { host: null } } as Packed<'Notification'>;
		expect(isUserFromMutedInstance(notif, new Set(['']))).toBe(true);
	});

	test('returns false when muted set is empty', () => {
		const notif = { user: { host: 'some.example' } } as Packed<'Notification'>;
		expect(isUserFromMutedInstance(notif, new Set())).toBe(false);
	});
});
