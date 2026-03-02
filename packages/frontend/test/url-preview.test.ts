import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup, type RenderResult } from '@testing-library/vue';
import './init';
import type { summaly } from 'summaly';
import { components } from '@/components';
import { directives } from '@/directives';
import MkUrlPreview from '@/components/MkUrlPreview.vue';

type SummalyResult = Awaited<ReturnType<typeof summaly>>;

describe('MkMediaImage', () => {
	const renderPreviewBy = async (summary: Partial<SummalyResult>): Promise<RenderResult> => {
		if (!summary.player) {
			summary.player = {
				url: null,
				width: null,
				height: null,
				allow: [],
			};
		}

		fetchMock.mockOnceIf(/^\/url?/, () => {
			return {
				status: 200,
				body: JSON.stringify(summary),
			};
		});

		const result = render(MkUrlPreview, {
			props: { url: summary.url },
			global: { directives, components },
		});

		await new Promise<void>(resolve => {
			const observer = new MutationObserver(() => {
				resolve();
				observer.disconnect();
			});
			observer.observe(result.container, { childList: true, subtree: true });
		});

		return result;
	};

	const renderAndOpenPreview = async (summary: Partial<SummalyResult>): Promise<HTMLIFrameElement | null> => {
		const mkUrlPreview = await renderPreviewBy(summary);
		const buttons = mkUrlPreview.getAllByRole('button');
		buttons[0].click();
		// Wait for the click event to be fired
		await Promise.resolve();

		return mkUrlPreview.container.querySelector('iframe');
	};

	afterEach(() => {
		fetchMock.resetMocks();
		cleanup();
	});

	test('Should render the description', async () => {
		const mkUrlPreview = await renderPreviewBy({
			url: 'https://example.local',
			description: 'Mocked description',
		});
		mkUrlPreview.getByText('Mocked description');
	});

	test('Should render the title', async () => {
		const mkUrlPreview = await renderPreviewBy({
			url: 'https://example.local',
			title: 'Mocked Title',
		});
		mkUrlPreview.getByText('Mocked Title');
	});

	test('Having a player should render a button', async () => {
		const mkUrlPreview = await renderPreviewBy({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: [],
			},
		});
		const buttons = mkUrlPreview.getAllByRole('button');
		assert.strictEqual(buttons.length, 2, 'two buttons');
	});

	test('Having a player should setup the iframe', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: [],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.src, 'https://example.local/player?autoplay=1&auto_play=1');
		assert.strictEqual(
			iframe?.sandbox.toString(),
			'allow-popups allow-scripts allow-storage-access-by-user-activation allow-same-origin',
		);
	});

	test('Having a player with `allow` field should set permissions', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: null,
				allow: ['fullscreen', 'web-share'],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.allow, 'fullscreen;web-share');
	});

	test('Having a player width should keep the fixed aspect ratio', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: 400,
				height: 200,
				allow: [],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.parentElement?.style.paddingTop, '50%');
	});

	test('Having a player width should keep the fixed height', async () => {
		const iframe = await renderAndOpenPreview({
			url: 'https://example.local',
			player: {
				url: 'https://example.local/player',
				width: null,
				height: 200,
				allow: [],
			},
		});
		assert.exists(iframe, 'iframe should exist');
		assert.strictEqual(iframe?.parentElement?.style.paddingTop, '200px');
	});

	test('Should handle Twitter URLs correctly', async () => {
		const mkUrlPreview = await renderPreviewBy({
			url: 'https://twitter.com/misskey_io/status/1234567890',
			title: 'Twitter Post',
		});

		// By default detail/expanded is false.
		// It should show a button to expand tweet.
		// We can look for the icon or text. Text is i18n.ts.expandTweet.
		// Since we use init.ts which loads en-US, it should be "Expand tweet".
		const expandButton = mkUrlPreview.getByText('Expand tweet');
		assert.exists(expandButton);
		
		expandButton.click();
		// Wait for update (render iframe)
		await Promise.resolve();
		await new Promise(r => setTimeout(r, 0));

		// It should render iframe for twitter
		// The iframe src should contain the tweet ID
		const iframe = mkUrlPreview.container.querySelector('iframe');
		assert.exists(iframe);
		assert.include(iframe?.src, 'id=1234567890');
	});

	test('Should handle unknown URLs gracefully', async () => {
		// Mock fetch failure or invalid response for unknown URL
		fetchMock.mockOnceIf(/^\/url?/, () => {
			return {
				status: 404,
			};
		});

		const result = render(MkUrlPreview, {
			props: { url: 'https://unknown.example.com' },
			global: { directives, components },
		});
		
		await new Promise<void>(resolve => {
			// MutationObserver logic like renderPreviewBy, but we can't use renderPreviewBy 
			// because it assumes success and mutation.
			// Here we just wait a bit for fetch to fail and component to update.
			setTimeout(resolve, 50);
		});

		// Should show failed text: i18n.ts.failedToPreviewUrl
		// en-US: "Could not preview"
		try {
			result.getByText('Could not preview');
		} catch (e) {
			// If text not found, maybe show more info or just fail
			throw e;
		}
	});
});
