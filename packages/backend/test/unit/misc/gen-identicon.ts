process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import { Writable } from 'node:stream';
import { genIdenticon } from '@/misc/gen-identicon.js';

describe('misc:gen-identicon', () => {
	test('writes PNG data to stream', async () => {
		const chunks: Buffer[] = [];
		const stream = new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				callback();
			},
		});

		await genIdenticon('testseed', stream as any);

		expect(chunks.length).toBeGreaterThan(0);
		const result = Buffer.concat(chunks);
		expect(result.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
	});

	test('produces deterministic output for same seed', async () => {
		const run = async () => {
			const chunks: Buffer[] = [];
			const stream = new Writable({
				write(chunk, _encoding, callback) {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
					callback();
				},
			});
			await genIdenticon('same-seed', stream as any);
			return Buffer.concat(chunks);
		};

		const first = await run();
		const second = await run();

		expect(first.equals(second)).toBe(true);
	});

	test('produces different output for different seeds', async () => {
		const run = async (seed: string) => {
			const chunks: Buffer[] = [];
			const stream = new Writable({
				write(chunk, _encoding, callback) {
					chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
					callback();
				},
			});
			await genIdenticon(seed, stream as any);
			return Buffer.concat(chunks);
		};

		const first = await run('seed-a');
		const second = await run('seed-b');

		expect(first.equals(second)).toBe(false);
	});
});
