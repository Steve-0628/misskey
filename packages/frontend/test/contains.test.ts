import { describe, test, assert } from 'vitest';
import contains from '../src/scripts/contains';

describe('contains', () => {
	test('returns true if parent contains child', () => {
		const parent = document.createElement('div');
		const child = document.createElement('span');
		parent.appendChild(child);

		assert.isTrue(contains(parent, child));
	});

	test('returns true if parent is child (checkSame=true)', () => {
		const div = document.createElement('div');
		assert.isTrue(contains(div, div));
	});

	test('returns false if parent is child (checkSame=false)', () => {
		const div = document.createElement('div');
		assert.isFalse(contains(div, div, false));
	});

	test('returns false if not contained', () => {
		const parent = document.createElement('div');
		const child = document.createElement('span');
		
		assert.isFalse(contains(parent, child));
	});

	test('returns true for nested child', () => {
		const parent = document.createElement('div');
		const mid = document.createElement('div');
		const child = document.createElement('span');
		parent.appendChild(mid);
		mid.appendChild(child);

		assert.isTrue(contains(parent, child));
	});
});
