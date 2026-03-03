process.env.NODE_ENV = 'test';

import { parse, toString } from '@/misc/acct.js';

describe('acct', () => {
	describe('parse', () => {
		test('parses a local username (no host)', () => {
			expect(parse('alice')).toEqual({ username: 'alice', host: null });
		});

		test('parses a remote username with host', () => {
			expect(parse('alice@example.com')).toEqual({ username: 'alice', host: 'example.com' });
		});

		test('strips leading @ before parsing', () => {
			expect(parse('@alice')).toEqual({ username: 'alice', host: null });
		});

		test('strips leading @ when host is present', () => {
			expect(parse('@alice@example.com')).toEqual({ username: 'alice', host: 'example.com' });
		});

		test('returns null host for username without @', () => {
			const result = parse('bob');
			expect(result.host).toBeNull();
		});

		test('handles subdomain hosts', () => {
			expect(parse('user@sub.domain.example.com')).toEqual({ username: 'user', host: 'sub.domain.example.com' });
		});

		test('only splits on the first @ when multiple @ are present', () => {
			// split('@', 2) stops at the second segment — the host cannot contain @
			const result = parse('user@host@extra');
			expect(result.username).toBe('user');
			expect(result.host).toBe('host');
		});

		test('handles empty string username', () => {
			expect(parse('@')).toEqual({ username: '', host: null });
		});
	});

	describe('toString', () => {
		test('returns just the username when host is null', () => {
			expect(toString({ username: 'alice', host: null })).toBe('alice');
		});

		test('returns username@host when host is set', () => {
			expect(toString({ username: 'alice', host: 'example.com' })).toBe('alice@example.com');
		});

		test('round-trips a local acct', () => {
			const acct = { username: 'bob', host: null };
			expect(parse(toString(acct))).toEqual(acct);
		});

		test('round-trips a remote acct', () => {
			const acct = { username: 'carol', host: 'remote.example' };
			expect(parse(toString(acct))).toEqual(acct);
		});
	});
});
