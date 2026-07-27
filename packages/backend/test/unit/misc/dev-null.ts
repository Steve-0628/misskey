process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { DevNull } from '@/misc/dev-null.js';

describe('DevNull', () => {
	test('writes data without error', (done) => {
		const stream = new DevNull();
		stream.on('finish', () => {
			expect(true).toBe(true);
			done();
		});
		stream.end('hello');
	});
});
