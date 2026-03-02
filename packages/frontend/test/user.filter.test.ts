import { describe, test, assert, vi } from 'vitest';
import { acct, userName, userPage } from '../src/filters/user';

// Mock config
vi.mock('@/config', () => ({
	url: 'https://misskey.test',
}));

describe('user filter', () => {
	const localUser = {
		id: 'u1',
		username: 'alice',
		name: 'Alice',
		host: null,
	} as any;

	const remoteUser = {
		id: 'u2',
		username: 'bob',
		name: null,
		host: 'remote.test',
	} as any;

	describe('acct', () => {
		test('returns username for local user', () => {
			assert.strictEqual(acct(localUser), 'alice');
		});

		test('returns username@host for remote user', () => {
			assert.strictEqual(acct(remoteUser), 'bob@remote.test');
		});
	});

	describe('userName', () => {
		test('returns name if available', () => {
			assert.strictEqual(userName(localUser), 'Alice');
		});

		test('returns username if name is missing', () => {
			assert.strictEqual(userName(remoteUser), 'bob');
		});
	});

	describe('userPage', () => {
		test('returns absolute url', () => {
			assert.strictEqual(userPage(localUser, undefined, true), 'https://misskey.test/@alice');
		});

		test('returns relative url by default', () => {
			assert.strictEqual(userPage(localUser), '/@alice');
		});

		test('handles path argument', () => {
			assert.strictEqual(userPage(localUser, 'foo'), '/@alice/foo');
		});
	});
});
