import { describe, test, assert, vi, afterEach } from 'vitest';
import { getCompressionConfig } from '../src/scripts/upload/compress-config';
import * as IsWebpSupported from '../src/scripts/upload/isWebpSupported';
import * as IsFileAnimated from 'is-file-animated';

// Mock isWebpSupported
const isWebpMock = vi.spyOn(IsWebpSupported, 'isWebpSupported');

// Mock is-file-animated
// Since it's a default export often, we need to check how it's imported. 
// "import isAnimated from 'is-file-animated'"
// We'll try mocking the module.
vi.mock('is-file-animated', () => ({
	default: vi.fn(),
}));

// We need to import the mocked function to control it
import isAnimated from 'is-file-animated';

describe('getCompressionConfig', () => {
	afterEach(() => {
		vi.resetAllMocks();
	});

	// Helper to create a dummy File
	const createFile = (type: string) => {
		return {
			type,
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as File;
	};

	test('returns undefined for non-image types', async () => {
		(isAnimated as any).mockResolvedValue(false);
		isWebpMock.mockReturnValue(true);

		const file = createFile('text/plain');
		const config = await getCompressionConfig(file);
		assert.isUndefined(config);
	});

	test('returns undefined for animated images', async () => {
		(isAnimated as any).mockResolvedValue(true);
		isWebpMock.mockReturnValue(true);

		const file = createFile('image/png');
		const config = await getCompressionConfig(file);
		assert.isUndefined(config);
	});

	test('returns webp config when webp is supported', async () => {
		(isAnimated as any).mockResolvedValue(false);
		isWebpMock.mockReturnValue(true);

		const file = createFile('image/jpeg');
		const config = await getCompressionConfig(file);
		
		assert.exists(config);
		assert.strictEqual(config?.mimeType, 'image/webp');
		assert.strictEqual(config?.quality, 0.90);
	});

	test('returns fallback config when webp is NOT supported', async () => {
		(isAnimated as any).mockResolvedValue(false);
		isWebpMock.mockReturnValue(false);

		const file = createFile('image/jpeg');
		const config = await getCompressionConfig(file);
		
		assert.exists(config);
		assert.strictEqual(config?.mimeType, 'image/jpeg'); // Fallback map
		assert.strictEqual(config?.quality, 0.85);
	});

	test('svg uses png fallback when webp unsupported', async () => {
		(isAnimated as any).mockResolvedValue(false);
		isWebpMock.mockReturnValue(false);

		const file = createFile('image/svg+xml');
		const config = await getCompressionConfig(file);
		
		assert.strictEqual(config?.mimeType, 'image/png');
	});
});
