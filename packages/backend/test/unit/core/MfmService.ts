process.env.NODE_ENV = 'test';

import { afterEach, describe, test, expect } from '@jest/globals';
import * as mfm from 'mfm-js';
import { MfmService } from '@/core/MfmService.js';
import type { Config } from '@/config.js';

describe('MfmService', () => {
	const services: MfmService[] = [];

	function createService(): MfmService {
		const service = new MfmService({ url: 'https://example.com' } as Config);
		services.push(service);
		return service;
	}

	afterEach(async () => {
		await Promise.all(services.splice(0).map(service => service.onApplicationShutdown()));
	});

	describe('fromHtml', () => {
		test('converts plain text', () => {
			const service = createService();
			expect(service.fromHtml('hello world')).toBe('hello world');
		});

		test('converts br tags to newlines', () => {
			const service = createService();
			expect(service.fromHtml('a<br>b')).toBe('a\nb');
		});

		test('converts br tags with newlines', () => {
			const service = createService();
			expect(service.fromHtml('a<br>\nb')).toBe('a\nb');
		});

		test('converts h1 tags', () => {
			const service = createService();
			expect(service.fromHtml('<h1>title</h1>')).toBe('【title】');
		});

		test('converts bold tags', () => {
			const service = createService();
			expect(service.fromHtml('<b>bold</b>')).toBe('**bold**');
			expect(service.fromHtml('<strong>bold</strong>')).toBe('**bold**');
		});

		test('converts small tags', () => {
			const service = createService();
			expect(service.fromHtml('<small>small</small>')).toBe('<small>small</small>');
		});

		test('converts strike tags', () => {
			const service = createService();
			expect(service.fromHtml('<s>strike</s>')).toBe('~~strike~~');
			expect(service.fromHtml('<del>strike</del>')).toBe('~~strike~~');
		});

		test('converts italic tags', () => {
			const service = createService();
			expect(service.fromHtml('<i>italic</i>')).toBe('<i>italic</i>');
			expect(service.fromHtml('<em>italic</em>')).toBe('<i>italic</i>');
		});

		test('converts code tags', () => {
			const service = createService();
			expect(service.fromHtml('<code>code</code>')).toBe('`code`');
		});

		test('converts pre code block', () => {
			const service = createService();
			expect(service.fromHtml('<pre><code>code block</code></pre>')).toContain('```');
			expect(service.fromHtml('<pre><code>code block</code></pre>')).toContain('code block');
		});

		test('converts blockquote', () => {
			const service = createService();
			expect(service.fromHtml('<blockquote>quote</blockquote>')).toContain('> quote');
		});

		test('converts link with text', () => {
			const service = createService();
			expect(service.fromHtml('<a href="https://example.com/path">link</a>')).toBe('[link](https://example.com/path)');
		});

		test('converts bare link', () => {
			const service = createService();
			expect(service.fromHtml('<a href="https://example.com">https://example.com</a>')).toBe('https://example.com');
		});

		test('converts mention with href', () => {
			const service = createService();
			expect(service.fromHtml('<a href="https://remote.example/@bob">@bob</a>')).toBe('@bob@remote.example');
		});

		test('keeps hashtag link as text when hashtagNames provided', () => {
			const service = createService();
			expect(service.fromHtml('<a href="https://example.com/tags/foo">#foo</a>', ['#foo'])).toBe('#foo');
		});

		test('converts paragraph and headers to newlines', () => {
			const service = createService();
			expect(service.fromHtml('<p>para</p><h2>head</h2>')).toContain('para');
		});
	});

	describe('toHtml', () => {
		test('returns null for null nodes', () => {
			const service = createService();
			expect(service.toHtml(null)).toBeNull();
		});

		test('does not retain document content between conversions', () => {
			const service = createService();
			expect(service.toHtml(mfm.parse('first'))).toBe('<p><span>first</span></p>');
			expect(service.toHtml(mfm.parse('second'))).toBe('<p><span>second</span></p>');
		});

		test('can render after its detached window is closed', async () => {
			const service = createService();
			expect(service.toHtml(mfm.parse('before'))).toBe('<p><span>before</span></p>');

			await service.onApplicationShutdown();

			expect(service.toHtml(mfm.parse('after'))).toBe('<p><span>after</span></p>');
		});

		test('converts bold node', () => {
			const service = createService();
			const html = service.toHtml([{ type: 'bold', children: [{ type: 'text', props: { text: 'bold' } }] }] as any);
			expect(html).toBe('<p><b><span>bold</span></b></p>');
		});

		test('converts italic node', () => {
			const service = createService();
			const html = service.toHtml([{ type: 'italic', children: [{ type: 'text', props: { text: 'italic' } }] }] as any);
			expect(html).toBe('<p><i><span>italic</span></i></p>');
		});

		test('converts strike node', () => {
			const service = createService();
			const html = service.toHtml([{ type: 'strike', children: [{ type: 'text', props: { text: 'strike' } }] }] as any);
			expect(html).toBe('<p><del><span>strike</span></del></p>');
		});

		test('converts inlineCode node', () => {
			const service = createService();
			const html = service.toHtml([{ type: 'inlineCode', props: { code: 'code' } }] as any);
			expect(html).toBe('<p><code>code</code></p>');
		});

		test('converts blockCode node', () => {
			const service = createService();
			const html = service.toHtml([{ type: 'blockCode', props: { code: 'block' } }] as any);
			expect(html).toBe('<p><pre><code>block</code></pre></p>');
		});

		test('converts hashtag node', () => {
			const service = createService();
			const html = service.toHtml([{ type: 'hashtag', props: { hashtag: 'foo' } }] as any);
			expect(html).toBe('<p><a href="https://example.com/tags/foo" rel="tag">#foo</a></p>');
		});

		test('converts emojiCode node', () => {
			const service = createService();
			const html = service.toHtml([{ type: 'emojiCode', props: { name: 'grin' } }] as any);
			expect(html).toContain(':grin:');
		});

		test('converts unicodeEmoji node', () => {
			const service = createService();
			const html = service.toHtml([{ type: 'unicodeEmoji', props: { emoji: '😀' } }] as any);
			expect(html).toBe('<p>😀</p>');
		});
	});
});
