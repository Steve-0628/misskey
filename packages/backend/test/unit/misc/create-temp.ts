process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { createTemp, createTempDir } from '@/misc/create-temp.js';
import { existsSync } from 'node:fs';

describe('create-temp', () => {
	test('createTemp returns a path and no-op cleanup in test env', async () => {
		const [path, cleanup] = await createTemp();
		expect(typeof path).toBe('string');
		expect(path.length).toBeGreaterThan(0);
		expect(typeof cleanup).toBe('function');
		cleanup();
	});

	test('createTempDir returns a path and no-op cleanup in test env', async () => {
		const [path, cleanup] = await createTempDir();
		expect(typeof path).toBe('string');
		expect(existsSync(path)).toBe(true);
		expect(typeof cleanup).toBe('function');
		cleanup();
	});
});
