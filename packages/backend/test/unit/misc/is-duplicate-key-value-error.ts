process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { QueryFailedError } from 'typeorm';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';

describe('isDuplicateKeyValueError', () => {
	test('returns true for QueryFailedError with code 23505', () => {
		const err = new QueryFailedError('INSERT', [], new Error('duplicate') as any);
		(err.driverError as any).code = '23505';
		expect(isDuplicateKeyValueError(err)).toBe(true);
	});

	test('returns false for QueryFailedError with other code', () => {
		const err = new QueryFailedError('SELECT', [], new Error('other') as any);
		(err.driverError as any).code = '42601';
		expect(isDuplicateKeyValueError(err)).toBe(false);
	});

	test('returns false for non-QueryFailedError', () => {
		expect(isDuplicateKeyValueError(new Error('foo'))).toBe(false);
	});
});
