import { describe, test, vi, afterEach, beforeEach, expect } from 'vitest';

describe('test-webgl2 worker', () => {
    let postMessageSpy: any;

    beforeEach(() => {
        postMessageSpy = vi.fn();
        global.postMessage = postMessageSpy;

        // Ensure globals are configurable
        Object.defineProperty(global, 'OffscreenCanvas', {
            value: undefined,
            writable: true,
            configurable: true,
        });

        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Clean up global
        (global as any).OffscreenCanvas = undefined;
        delete (global as any).postMessage;
    });

    test('posts true when webgl2 is supported', async () => {
        // Mock global scope
        (global as any).OffscreenCanvas = class {
            getContext(type: string) {
                return type === 'webgl2' ? {} : null;
            }
        };

        await import('../../src/workers/test-webgl2.js');

        expect(postMessageSpy).toHaveBeenCalledWith({ result: true });
    });

    test('posts false when webgl2 is NOT supported', async () => {
        // Mock global scope with failing getContext
        (global as any).OffscreenCanvas = class {
            getContext(type: string) {
                return null;
            }
        };

        // Reset modules again to reload the script
        vi.resetModules();
        await import('../../src/workers/test-webgl2.js');

        expect(postMessageSpy).toHaveBeenCalledWith({ result: false });
    });

    test('posts false when OffscreenCanvas is undefined', async () => {
        (global as any).OffscreenCanvas = undefined;

        vi.resetModules();
        await import('../../src/workers/test-webgl2.js');

        expect(postMessageSpy).toHaveBeenCalledWith({ result: false });
    });
});
