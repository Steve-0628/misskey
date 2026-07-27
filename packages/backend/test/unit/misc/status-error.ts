process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { StatusError } from '@/misc/status-error.js';

describe('StatusError', () => {
	test('sets client error true for 404', () => {
		const err = new StatusError('not found', 404, 'Not Found');
		expect(err.statusCode).toBe(404);
		expect(err.statusMessage).toBe('Not Found');
		expect(err.isClientError).toBe(true);
		expect(err.name).toBe('StatusError');
	});

	test('sets client error false for 500', () => {
		const err = new StatusError('server error', 500);
		expect(err.statusCode).toBe(500);
		expect(err.isClientError).toBe(false);
	});
});
