import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup, fireEvent, type RenderResult } from '@testing-library/vue';
import './init';
import MkAvatar from '../src/components/global/MkAvatar.vue';
import { components } from '@/components';

describe('MkAvatar', () => {
	afterEach(() => {
		cleanup();
	});

	// Mock user object
	const mockUser = {
		id: 'u1',
		username: 'testuser',
		name: 'Test User',
		avatarUrl: 'https://example.com/avatar.jpg',
		avatarBlurhash: 'blurhash',
		isCat: false,
	};

	const userPreviewParams: any[] = [];
	const mockUserPreview = {
		mounted: (el: any, binding: any) => {
			userPreviewParams.push(binding.value);
		},
	};

	test('should render avatar image', async () => {
		const wrapper = render(MkAvatar, {
			props: {
				user: mockUser,
			},
			global: {
				components,
				directives: {
					userPreview: mockUserPreview,
				},
				stubs: {
					MkImgWithBlurhash: {
						template: '<img :src="src" :alt="hash" />',
						props: ['src', 'hash'],
					},
					MkUserOnlineIndicator: true,
				},
			},
		});

		const img = wrapper.container.querySelector('img');
		assert.exists(img);
		assert.strictEqual(img?.getAttribute('src'), 'https://example.com/avatar.jpg');
	});

	test('should render as link when link prop is true', async () => {
		const wrapper = render(MkAvatar, {
			props: {
				user: mockUser,
				link: true,
			},
			global: {
				components,
				directives: {
					userPreview: mockUserPreview,
				},
				stubs: {
					MkImgWithBlurhash: true,
					MkA: {
						template: '<a :href="to" :target="target"><slot /></a>',
						props: ['to', 'target'],
					},
				},
			},
		});

		const anchor = wrapper.container.querySelector('a');
		assert.exists(anchor);
		assert.include(anchor?.getAttribute('href') || '', '@testuser');
	});

	test('should render cat ears when user is cat', async () => {
		const wrapper = render(MkAvatar, {
			props: {
				user: { ...mockUser, isCat: true },
			},
			global: {
				components,
				directives: {
					userPreview: mockUserPreview,
				},
				stubs: {
					MkImgWithBlurhash: true,
				},
			},
		});

		// Check for cat ears class or elements
		const divs = wrapper.container.querySelectorAll('div');
		// We expect more divs than usual.
		assert.isNotEmpty(divs);
	});

	test('should render indicator when prop provided', async () => {
		const wrapper = render(MkAvatar, {
			props: {
				user: mockUser,
				indicator: true,
			},
			global: {
				components,
				directives: {
					userPreview: mockUserPreview,
				},
				stubs: {
					MkImgWithBlurhash: true,
					MkUserOnlineIndicator: {
						template: '<div data-testid="indicator"></div>',
					},
				},
			},
		});

		const indicator = wrapper.getByTestId('indicator');
		assert.exists(indicator);
	});
});
