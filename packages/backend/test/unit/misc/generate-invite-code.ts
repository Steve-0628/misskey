process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { generateInviteCode } from '@/misc/generate-invite-code.js';

describe('generateInviteCode', () => {
	let spy: ReturnType<typeof jest.spyOn> | null = null;

	beforeEach(() => {
		const fixed = new Date('2026-01-01T00:10:00.000Z').getTime();
		spy = jest.spyOn(Date, 'now').mockReturnValue(fixed);
	});

	afterEach(() => {
		if (spy) {
			spy.mockRestore();
			spy = null;
		}
	});

	test('produces a string long enough (8 + suffix)', () => {
		const code = generateInviteCode();
		expect(code.length).toBeGreaterThanOrEqual(9);
	});

	test('suffix contains only allowed characters', () => {
		const code = generateInviteCode();
		const suffix = code.slice(8);
		expect(/^[23456789A-Z]+$/.test(suffix)).toBe(true);
	});

	test('invoking twice produces different codes (random prefix)', () => {
		const a = generateInviteCode();
		const b = generateInviteCode();
		expect(a).not.toBe(b);
	});
});
