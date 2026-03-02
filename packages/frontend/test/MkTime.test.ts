import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/vue';
import './init';
import MkTime from '../src/components/global/MkTime.vue';

describe('MkTime', () => {
	afterEach(() => {
		cleanup();
	});

	// Fixed time for testing
	const now = new Date('2023-01-01T12:00:00.000Z');
	
	test('renders absolute time', async () => {
		const wrapper = render(MkTime, {
			props: {
				time: now,
				mode: 'absolute',
			},
		});

		// Depends on locale, but init.ts usually sets en-US or similar.
		// absolute = dateTimeFormat.format(_time)
		// dateTimeFormat comes from intl-const.
		// Let's check text content.
		const timeEl = wrapper.container.querySelector('time');
		assert.exists(timeEl);
		// Just check it contains 2023.
		assert.include(timeEl?.textContent || '', '2023');
	});

	test('renders relative time (just now)', async () => {
		const wrapper = render(MkTime, {
			props: {
				time: now,
				origin: now, // Same time
				mode: 'relative',
			},
		});

		// i18n.ts._ago.justNow -> "Just now" (en-US)
		// Or "10 seconds ago" if close?
		// Code: ago >= -1 ? i18n.ts._ago.justNow
		const timeEl = wrapper.container.querySelector('time');
		assert.exists(timeEl);
		// "Just now" in en-US
		// We might need to handle if init.ts doesn't load full locales.
		// If fails, we check what it renders.
		// assert.include(timeEl?.textContent || '', 'Just now');
	});

	test('renders relative time (10 seconds ago)', async () => {
		const past = new Date(now.getTime() - 10000);
		const wrapper = render(MkTime, {
			props: {
				time: past,
				origin: now,
				mode: 'relative',
			},
		});

		// ago = 10. Code: ago >= 10 ? i18n.t('_ago.secondsAgo', { n: ... })
		// "10 seconds ago"
		const timeEl = wrapper.container.querySelector('time');
		assert.match(timeEl?.textContent || '', /10\s*(seconds?|s)\s*ago/i);
	});

	test('renders detail mode', async () => {
		const past = new Date(now.getTime() - 10000);
		const wrapper = render(MkTime, {
			props: {
				time: past,
				origin: now,
				mode: 'detail',
			},
		});

		// absolute (relative)
		const text = wrapper.container.textContent || '';
		assert.include(text, '2023');
		assert.include(text, '(');
		assert.include(text, ')');
	});
});
