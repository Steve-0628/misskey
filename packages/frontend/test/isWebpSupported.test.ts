import { describe, test, assert, vi, afterEach, expect } from 'vitest';
import { isWebpSupported } from '../src/scripts/upload/isWebpSupported';

describe('isWebpSupported', () => {
	// We need to reset the module cache or the internal cache variable between tests if we want to test both true and false.
	// Since the cache is a module-level variable, we might need to reload the module or assume it's one-way.
	// However, we can mock the canvas before importing or use verify isolation.
	
	// A simpler way: since we can't easily reset the module-level variable `isWebpSupportedCache` from outside
	// without exporting it or using `vi.resetModules()`.
	
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	test('returns true if canvas supports webp', async () => {
		// Mock needs to be set up BEFORE module import if we rely on side effects, 
		// but here function is exported. Variable is lazy initialized on call.
		
		const mockToDataURL = vi.fn((type: string) => {
			if (type === 'image/webp') return 'data:image/webp;base64,...';
			return 'data:image/png;base64,...';
		});

		const mockCanvas = {
			width: 0,
			height: 0,
			toDataURL: mockToDataURL,
		};

		const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as any);

		// Re-import to ensure clear cache if needed, but since we use `resetModules` in afterEach,
		// we should probably do `await import(...)` inside test?
		// But let's try assuming the first call populates it.
		// Issue: if we imported it at top level, cache might be set if previous tests ran (unlikely here).
		
		// To be safe with module state, we'll use inline import.
		const { isWebpSupported } = await import('../src/scripts/upload/isWebpSupported');
		
		assert.isTrue(isWebpSupported());
		
		// Verify mock usage
		assert.strictEqual(mockCanvas.width, 1);
		assert.strictEqual(mockCanvas.height, 1);
		expect(mockToDataURL).toHaveBeenCalledWith('image/webp');
	});

	test('returns false if canvas does not support webp', async () => {
		const mockToDataURL = vi.fn((type: string) => {
			return 'data:image/png;base64,...'; // Fallback
		});

		const mockCanvas = {
			width: 0,
			height: 0,
			toDataURL: mockToDataURL,
		};

		vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as any);

		// Force re-import to get fresh module scope/cache
		vi.resetModules();
		const { isWebpSupported } = await import('../src/scripts/upload/isWebpSupported');

		assert.isFalse(isWebpSupported());
	});
});
