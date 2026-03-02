import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor, type RenderResult } from '@testing-library/vue';
import './init';
import type { DriveFile } from 'misskey-js/built/entities';
import { components } from '@/components';
import { directives } from '@/directives';
import MkMediaImage from '@/components/MkMediaImage.vue';

describe('MkMediaImage', () => {
	const renderMediaImage = (image: Partial<DriveFile>): RenderResult => {
		return render(MkMediaImage, {
			props: {
				image: {
					id: 'xxxxxxxx',
					createdAt: (new Date()).toJSON(),
					isSensitive: false,
					name: 'example.png',
					thumbnailUrl: null,
					url: '',
					type: 'application/octet-stream',
					size: 1,
					md5: '15eca7fba0480996e2245f5185bf39f2',
					blurhash: null,
					comment: null,
					properties: {},
					...image,
				} as DriveFile,
			},
			global: { directives, components },
		});
	};

	afterEach(() => {
		cleanup();
	});

	test('Attaching JPG should show no indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/jpeg',
		});
		const [gif, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(!gif);
		assert.ok(!alt);
	});

	test('Attaching GIF should show a GIF indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/gif',
		});
		const [gif, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(gif);
		assert.ok(!alt);
	});

	test('Attaching APNG should show a GIF indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/apng',
		});
		const [gif, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(gif);
		assert.ok(!alt);
	});

	test('Attaching image with an alt message should show an ALT indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/png',
			comment: 'Misskeyのロゴです',
		});
		const [gif, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(!gif);
		assert.ok(alt);
	});

	test('Attaching GIF image with an alt message should show a GIF and an ALT indicator', async () => {
		const mkMediaImage = renderMediaImage({
			type: 'image/gif',
			comment: 'Misskeyのロゴです',
		});
		const [gif, alt] = await Promise.all([
			mkMediaImage.queryByText('GIF'),
			mkMediaImage.queryByText('ALT'),
		]);
		assert.ok(gif);
		assert.ok(alt);
	});

	test('Sensitive image should be hidden by default', async () => {
		const mkMediaImage = renderMediaImage({
			isSensitive: true,
		});
		// Check for sensitive text
		const sensitiveText = await mkMediaImage.queryByText('Sensitive');
		assert.ok(sensitiveText);
	});

	test('Clicking hidden sensitive image should reveal it', async () => {
		const mkMediaImage = renderMediaImage({
			isSensitive: true,
		});

		// Initially hidden, should show "Click to show"
		// i18n.ts.clickToShow -> "Click to show" (en-US)
		const clickToShow = await mkMediaImage.findByText('Click to show');
		assert.ok(clickToShow);

		// Click the component (container) to show
		// The click handler is on the root div
		await fireEvent.click(mkMediaImage.container.firstElementChild as Element);

		// Now "Click to show" should be gone
		// Using waitFor because it might trigger reactivity
		await waitFor(() => {
			assert.ok(!mkMediaImage.queryByText('Click to show'));
		});
	});
});
