import { describe, test, assert, vi, afterEach, beforeEach, expect } from 'vitest';

// Mock buraha
vi.mock('buraha', () => ({
	render: vi.fn(),
}));

describe('draw-blurhash worker', () => {
	let postMessageSpy: any;
	let onMessageFn: any;

	beforeEach(() => {
		// Mock OffscreenCanvas
		global.OffscreenCanvas = vi.fn().mockImplementation(() => ({
			transferToImageBitmap: vi.fn().mockReturnValue({}),
		})) as any;

		// Mock global worker scope
		postMessageSpy = vi.fn();
		global.postMessage = postMessageSpy;

		// Ensure onmessage is writable or defined
		Object.defineProperty(global, 'onmessage', {
			value: undefined,
			writable: true,
		});

		// Reset modules to re-evaluate the worker script
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		// Setting to undefined is safer than verify configurable delete
		(global as any).OffscreenCanvas = undefined;
		(global as any).onmessage = undefined;
		(global as any).postMessage = undefined;
	});

	test('processes valid message', async () => {
		// Import the worker script
		// It assigns to global.onmessage
		await import('../../src/workers/draw-blurhash.js');

		onMessageFn = global.onmessage;
		assert.exists(onMessageFn);

		// Trigger
		const event = {
			data: {
				id: '123',
				hash: 'LEHV6n9F.A5j}lI@=t5l.A.A.A.A',
			},
		};
		onMessageFn(event);

		expect(postMessageSpy).toHaveBeenCalledWith({
			id: '123',
			bitmap: {},
		});
	});

	test('ignores invalid message (missing id)', async () => {
		await import('../../src/workers/draw-blurhash.js');
		onMessageFn = global.onmessage;

		const event = {
			data: {
				// id missing
				hash: 'hash',
			},
		};
		onMessageFn(event);

		expect(postMessageSpy).not.toHaveBeenCalled();
	});

	test('ignores invalid message (missing hash)', async () => {
		await import('../../src/workers/draw-blurhash.js');
		onMessageFn = global.onmessage;

		const event = {
			data: {
				id: '123',
				// hash missing
			},
		};
		onMessageFn(event);

		expect(postMessageSpy).not.toHaveBeenCalled();
	});
});
