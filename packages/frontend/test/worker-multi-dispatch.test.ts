import { describe, test, assert, vi, afterEach, beforeEach, expect } from 'vitest';
import { WorkerMultiDispatch } from '../src/scripts/worker-multi-dispatch';

// Mock FinalizationRegistry if not present (Node < 14.6)
if (typeof FinalizationRegistry === 'undefined') {
	(global as any).FinalizationRegistry = class {
		register() {}
		unregister() {}
	};
}

describe('WorkerMultiDispatch', () => {
	let mockWorkers: any[] = [];
	
	// Mock Worker constructor function
	const mockWorkerConstructor = () => {
		const worker = {
			postMessage: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			terminate: vi.fn(),
		};
		mockWorkers.push(worker);
		return worker as any as Worker;
	};

	beforeEach(() => {
		mockWorkers = [];
		// Mock global _DEV_
		(global as any)._DEV_ = false;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('initializes with specified concurrency', () => {
		const dispatch = new WorkerMultiDispatch(mockWorkerConstructor, 3);
		assert.strictEqual(mockWorkers.length, 3);
	});

	test('distributes messages round-robin by default', () => {
		const dispatch = new WorkerMultiDispatch(mockWorkerConstructor, 2);
		
		// Starts at prev=0 -> next=1. So worker 1 first.
		dispatch.postMessage('msg1');
		expect(mockWorkers[1].postMessage).toHaveBeenCalledWith('msg1', undefined);
		expect(mockWorkers[0].postMessage).not.toHaveBeenCalled();

		// Next is prev=1 -> next=2 -> 0. Worker 0 second.
		dispatch.postMessage('msg2');
		expect(mockWorkers[0].postMessage).toHaveBeenCalledWith('msg2', undefined);

		// Next is prev=0 -> next=1. Worker 1 third.
		dispatch.postMessage('msg3');
		expect(mockWorkers[1].postMessage).toHaveBeenCalledWith('msg3', undefined);
	});

	test('adds listener to all workers', () => {
		const dispatch = new WorkerMultiDispatch(mockWorkerConstructor, 2);
		const callback = () => {};
		dispatch.addListener(callback);

		mockWorkers.forEach(worker => {
			expect(worker.addEventListener).toHaveBeenCalledWith('message', callback, undefined);
		});
	});

	test('removes listener from all workers', () => {
		const dispatch = new WorkerMultiDispatch(mockWorkerConstructor, 2);
		const callback = () => {};
		dispatch.removeListener(callback);

		mockWorkers.forEach(worker => {
			expect(worker.removeEventListener).toHaveBeenCalledWith('message', callback, undefined);
		});
	});

	test('terminates all workers', () => {
		const dispatch = new WorkerMultiDispatch(mockWorkerConstructor, 2);
		dispatch.terminate();

		assert.isTrue(dispatch.isTerminated());
		mockWorkers.forEach(worker => {
			expect(worker.terminate).toHaveBeenCalled();
		});
		assert.strictEqual(dispatch.getWorkers().length, 0);
	});

	test('supports custom worker selection strategy', () => {
		// Always pick first worker
		const customStrategy = (prev: number, total: number) => 0;
		const dispatch = new WorkerMultiDispatch(mockWorkerConstructor, 2, customStrategy);

		dispatch.postMessage('a');
		dispatch.postMessage('b');

		expect(mockWorkers[1].postMessage).not.toHaveBeenCalled();
	});

	test('supports postMessage with transferable array', () => {
		const dispatch = new WorkerMultiDispatch(mockWorkerConstructor, 1);
		const transfer = [new ArrayBuffer(1)];
		dispatch.postMessage('msg', transfer);
		expect(mockWorkers[0].postMessage).toHaveBeenCalledWith('msg', transfer);
	});

	test('exposes internal symbol', () => {
		const dispatch = new WorkerMultiDispatch(mockWorkerConstructor, 1);
		assert.exists(dispatch.getSymbol());
	});
});
