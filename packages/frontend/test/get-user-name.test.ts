import { describe, test, assert } from 'vitest';
import getUserName from '../src/scripts/get-user-name';

describe('get-user-name', () => {
	test('returns name if available', () => {
		const user = { name: 'Alice', username: 'alice' };
		assert.strictEqual(getUserName(user), 'Alice');
	});

	test('returns username if name is null', () => {
		const user = { name: null, username: 'alice' };
		assert.strictEqual(getUserName(user), 'alice');
	});

	test('returns username if name is undefined', () => {
		const user = { username: 'alice' };
		assert.strictEqual(getUserName(user), 'alice');
	});

	test('returns username if name is empty string', () => {
		const user = { name: '', username: 'alice' };
		assert.strictEqual(getUserName(user), 'alice');
	});
});
