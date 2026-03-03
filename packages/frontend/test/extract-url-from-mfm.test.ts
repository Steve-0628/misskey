import { describe, test, expect } from 'vitest';
import * as mfm from 'mfm-js';
import { extractUrlFromMfm } from '@/scripts/extract-url-from-mfm';

describe('extractUrlFromMfm', () => {
	test('extracts a single URL from text', () => {
		const nodes = mfm.parse('Check out https://example.com for more info');
		const urls = extractUrlFromMfm(nodes);
		expect(urls).toContain('https://example.com');
	});

	test('extracts multiple distinct URLs', () => {
		const nodes = mfm.parse('Visit https://example.com and https://misskey.io');
		const urls = extractUrlFromMfm(nodes);
		expect(urls).toContain('https://example.com');
		expect(urls).toContain('https://misskey.io');
	});

	test('returns empty array when no URLs present', () => {
		const nodes = mfm.parse('Hello world, no links here!');
		const urls = extractUrlFromMfm(nodes);
		expect(urls).toEqual([]);
	});

	test('deduplicates URLs that differ only by hash fragment', () => {
		const nodes = mfm.parse('https://example.com/#section1 https://example.com/#section2');
		const urls = extractUrlFromMfm(nodes);
		const exampleCount = urls.filter(u => u.startsWith('https://example.com/')).length;
		expect(exampleCount).toBe(1);
	});

	test('does not deduplicate URLs with different paths', () => {
		const nodes = mfm.parse('https://example.com/a https://example.com/b');
		const urls = extractUrlFromMfm(nodes);
		expect(urls.length).toBe(2);
	});

	test('extracts URL from a link node', () => {
		const nodes = mfm.parse('[click here](https://example.com)');
		const urls = extractUrlFromMfm(nodes);
		expect(urls).toContain('https://example.com');
	});

	test('skips silent links when respectSilentFlag is true (default)', () => {
		const nodes = mfm.parse('?[silent link](https://example.com)');
		const urls = extractUrlFromMfm(nodes, true);
		expect(urls).not.toContain('https://example.com');
	});

	test('includes silent links when respectSilentFlag is false', () => {
		const nodes = mfm.parse('?[silent link](https://example.com)');
		const urls = extractUrlFromMfm(nodes, false);
		expect(urls).toContain('https://example.com');
	});
});
