process.env.NODE_ENV = 'test';

import { assertActivityMatchesUrls } from '@/core/activitypub/misc/check-against-url.js';
import type { IObject } from '@/core/activitypub/type.js';

function activity(id: string): IObject {
	return { type: 'Note', id };
}

describe('assertActivityMatchesUrls', () => {
	test('accepts an object served from its id', () => {
		const url = 'https://remote.example/notes/1';
		expect(() => assertActivityMatchesUrls(url, activity(url), url)).not.toThrow();
	});

	test('accepts an alias that redirects to the canonical id', () => {
		expect(() => assertActivityMatchesUrls(
			'https://remote.example/@alice',
			activity('https://remote.example/users/alice'),
			'https://remote.example/users/alice',
		)).not.toThrow();
	});

	test('rejects an uploaded object claiming another path on the same host', () => {
		expect(() => assertActivityMatchesUrls(
			'https://remote.example/uploads/attacker.json',
			activity('https://remote.example/notes/victim'),
			'https://remote.example/uploads/attacker.json',
		)).toThrow('does not match response');
	});

	test('rejects a distinct www authority', () => {
		expect(() => assertActivityMatchesUrls(
			'https://www.remote.example/notes/1',
			activity('https://remote.example/notes/1'),
			'https://www.remote.example/notes/1',
		)).toThrow('different authority');
	});

	test('rejects a redirect to another authority', () => {
		expect(() => assertActivityMatchesUrls(
			'https://remote.example/notes/1',
			activity('https://remote.example/notes/1'),
			'https://other.example/notes/1',
		)).toThrow('does not match response');
	});
});
