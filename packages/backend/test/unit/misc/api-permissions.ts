process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { kinds } from '@/misc/api-permissions.js';

describe('api-permissions', () => {
	test('kinds contains expected permissions', () => {
		expect(kinds).toContain('read:account');
		expect(kinds).toContain('write:notes');
		expect(kinds.length).toBeGreaterThan(10);
	});
});
