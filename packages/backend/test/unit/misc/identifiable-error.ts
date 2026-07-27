process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { IdentifiableError } from '@/misc/identifiable-error.js';

describe('IdentifiableError', () => {
	test('stores id and message', () => {
		const err = new IdentifiableError('abc-123', 'something went wrong');
		expect(err.id).toBe('abc-123');
		expect(err.message).toBe('something went wrong');
		expect(err).toBeInstanceOf(Error);
	});

	test('uses empty string when message is omitted', () => {
		const err = new IdentifiableError('def-456');
		expect(err.id).toBe('def-456');
		expect(err.message).toBe('');
	});
});
