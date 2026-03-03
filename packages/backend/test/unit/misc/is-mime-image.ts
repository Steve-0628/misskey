process.env.NODE_ENV = 'test';

import { isMimeImage } from '@/misc/is-mime-image.js';

describe('isMimeImage', () => {
	describe('safe-file', () => {
		test('accepts image/jpeg', () => {
			expect(isMimeImage('image/jpeg', 'safe-file')).toBe(true);
		});

		test('accepts image/png', () => {
			expect(isMimeImage('image/png', 'safe-file')).toBe(true);
		});

		test('accepts image/gif', () => {
			expect(isMimeImage('image/gif', 'safe-file')).toBe(true);
		});

		test('accepts image/webp', () => {
			expect(isMimeImage('image/webp', 'safe-file')).toBe(true);
		});

		test('rejects application/octet-stream', () => {
			expect(isMimeImage('application/octet-stream', 'safe-file')).toBe(false);
		});

		test('rejects unknown mime type', () => {
			expect(isMimeImage('image/unknown-format', 'safe-file')).toBe(false);
		});
	});

	describe('sharp-convertible-image', () => {
		test('accepts image/jpeg', () => {
			expect(isMimeImage('image/jpeg', 'sharp-convertible-image')).toBe(true);
		});

		test('accepts image/avif', () => {
			expect(isMimeImage('image/avif', 'sharp-convertible-image')).toBe(true);
		});

		test('accepts image/svg+xml', () => {
			expect(isMimeImage('image/svg+xml', 'sharp-convertible-image')).toBe(true);
		});

		test('accepts image/apng', () => {
			expect(isMimeImage('image/apng', 'sharp-convertible-image')).toBe(true);
		});

		test('rejects image/bmp (not in this category)', () => {
			expect(isMimeImage('image/bmp', 'sharp-convertible-image')).toBe(false);
		});
	});

	describe('sharp-animation-convertible-image', () => {
		test('accepts image/gif', () => {
			expect(isMimeImage('image/gif', 'sharp-animation-convertible-image')).toBe(true);
		});

		test('accepts image/webp', () => {
			expect(isMimeImage('image/webp', 'sharp-animation-convertible-image')).toBe(true);
		});

		test('rejects image/apng (not in animation-convertible without bmp)', () => {
			expect(isMimeImage('image/apng', 'sharp-animation-convertible-image')).toBe(false);
		});

		test('rejects image/bmp', () => {
			expect(isMimeImage('image/bmp', 'sharp-animation-convertible-image')).toBe(false);
		});
	});

	describe('sharp-convertible-image-with-bmp', () => {
		test('accepts image/bmp', () => {
			expect(isMimeImage('image/bmp', 'sharp-convertible-image-with-bmp')).toBe(true);
		});

		test('accepts image/x-icon', () => {
			expect(isMimeImage('image/x-icon', 'sharp-convertible-image-with-bmp')).toBe(true);
		});

		test('accepts image/jpeg', () => {
			expect(isMimeImage('image/jpeg', 'sharp-convertible-image-with-bmp')).toBe(true);
		});
	});

	describe('sharp-animation-convertible-image-with-bmp', () => {
		test('accepts image/bmp', () => {
			expect(isMimeImage('image/bmp', 'sharp-animation-convertible-image-with-bmp')).toBe(true);
		});

		test('accepts image/gif', () => {
			expect(isMimeImage('image/gif', 'sharp-animation-convertible-image-with-bmp')).toBe(true);
		});

		test('rejects image/apng', () => {
			expect(isMimeImage('image/apng', 'sharp-animation-convertible-image-with-bmp')).toBe(false);
		});
	});
});
