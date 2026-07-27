import { describe, test, expect } from 'vitest';
import * as mfm from 'mfm-js';
import { extractMentions } from '@/scripts/extract-mentions';

describe('extractMentions', () => {
	test('extracts a single local mention', () => {
		const nodes = mfm.parse('@alice hello');
		const mentions = extractMentions(nodes);
		expect(mentions).toEqual([{ username: 'alice', host: null, acct: '@alice' }]);
	});

	test('extracts a remote mention', () => {
		const nodes = mfm.parse('@alice@example.com hello');
		const mentions = extractMentions(nodes);
		expect(mentions).toEqual([{ username: 'alice', host: 'example.com', acct: '@alice@example.com' }]);
	});

	test('extracts multiple mentions', () => {
		const nodes = mfm.parse('@alice @bob@example.com');
		const mentions = extractMentions(nodes);
		expect(mentions).toEqual([
			{ username: 'alice', host: null, acct: '@alice' },
			{ username: 'bob', host: 'example.com', acct: '@bob@example.com' },
		]);
	});

	test('returns empty array when no mentions present', () => {
		const nodes = mfm.parse('hello world');
		const mentions = extractMentions(nodes);
		expect(mentions).toEqual([]);
	});
});
