process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { QueueProcessorService } from '@/queue/QueueProcessorService.js';
import type { Config } from '@/config.js';
import type { QueueService } from '@/core/QueueService.js';
import type { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import type Logger from '@/logger.js';

function createQueue() {
	return {
		on: jest.fn().mockReturnThis(),
		process: jest.fn().mockReturnThis(),
		add: jest.fn().mockReturnThis(),
		close: jest.fn().mockResolvedValue(undefined),
	};
}

function createProcessor(name: string): any {
	return { process: jest.fn(), processDb: jest.fn() };
}

describe('QueueProcessorService', () => {
	function createService(configOverrides: any = {}) {
		const logger = {
			createSubLogger: jest.fn().mockReturnThis(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			succ: jest.fn(),
		} as unknown as Logger;

		const queueLoggerService = { logger } as unknown as QueueLoggerService;

		const queues: Record<string, ReturnType<typeof createQueue>> = {
			systemQueue: createQueue(),
			endedPollNotificationQueue: createQueue(),
			deliverQueue: createQueue(),
			inboxQueue: createQueue(),
			dbQueue: createQueue(),
			relationshipQueue: createQueue(),
			objectStorageQueue: createQueue(),
			webhookDeliverQueue: createQueue(),
		};

		const queueService = queues as unknown as QueueService;

		const config = {
			deliverJobConcurrency: 64,
			inboxJobConcurrency: 8,
			relashionshipJobConcurrency: 4,
			...configOverrides,
		} as Config;

		const processors: Record<string, any> = {};
		const processorNames = [
			'webhookDeliverProcessorService',
			'endedPollNotificationProcessorService',
			'deliverProcessorService',
			'inboxProcessorService',
			'deleteDriveFilesProcessorService',
			'exportCustomEmojisProcessorService',
			'exportNotesProcessorService',
			'exportFollowingProcessorService',
			'exportFavoritesProcessorService',
			'exportMutingProcessorService',
			'exportBlockingProcessorService',
			'exportUserListsProcessorService',
			'exportAntennasProcessorService',
			'importFollowingProcessorService',
			'importMutingProcessorService',
			'importBlockingProcessorService',
			'importUserListsProcessorService',
			'importCustomEmojisProcessorService',
			'importAntennasProcessorService',
			'deleteAccountProcessorService',
			'deleteFileProcessorService',
			'cleanRemoteFilesProcessorService',
			'relationshipProcessorService',
			'tickChartsProcessorService',
			'resyncChartsProcessorService',
			'cleanChartsProcessorService',
			'aggregateRetentionProcessorService',
			'checkExpiredMutingsProcessorService',
			'cleanProcessorService',
		];
		for (const name of processorNames) {
			processors[name] = createProcessor(name);
		}

		const service = new QueueProcessorService(
			config,
			queueLoggerService,
			queueService,
			processors.webhookDeliverProcessorService,
			processors.endedPollNotificationProcessorService,
			processors.deliverProcessorService,
			processors.inboxProcessorService,
			processors.deleteDriveFilesProcessorService,
			processors.exportCustomEmojisProcessorService,
			processors.exportNotesProcessorService,
			processors.exportFavoritesProcessorService,
			processors.exportFollowingProcessorService,
			processors.exportMutingProcessorService,
			processors.exportBlockingProcessorService,
			processors.exportUserListsProcessorService,
			processors.exportAntennasProcessorService,
			processors.importFollowingProcessorService,
			processors.importMutingProcessorService,
			processors.importBlockingProcessorService,
			processors.importUserListsProcessorService,
			processors.importCustomEmojisProcessorService,
			processors.importAntennasProcessorService,
			processors.deleteAccountProcessorService,
			processors.deleteFileProcessorService,
			processors.cleanRemoteFilesProcessorService,
			processors.relationshipProcessorService,
			processors.tickChartsProcessorService,
			processors.resyncChartsProcessorService,
			processors.cleanChartsProcessorService,
			processors.aggregateRetentionProcessorService,
			processors.checkExpiredMutingsProcessorService,
			processors.cleanProcessorService,
		);

		return { service, queues, processors, logger };
	}

	test('registers event listeners on queues that use them', () => {
		const { queues } = createService();
		const queuesWithListeners = [
			queues.systemQueue,
			queues.deliverQueue,
			queues.inboxQueue,
			queues.dbQueue,
			queues.relationshipQueue,
			queues.objectStorageQueue,
			queues.webhookDeliverQueue,
		];

		for (const queue of queuesWithListeners) {
			expect(queue.on).toHaveBeenCalledWith('waiting', expect.any(Function));
			expect(queue.on).toHaveBeenCalledWith('active', expect.any(Function));
			expect(queue.on).toHaveBeenCalledWith('completed', expect.any(Function));
			expect(queue.on).toHaveBeenCalledWith('failed', expect.any(Function));
			expect(queue.on).toHaveBeenCalledWith('error', expect.any(Function));
			expect(queue.on).toHaveBeenCalledWith('stalled', expect.any(Function));
		}
	});

	test('registers processors with configured concurrency', () => {
		const { queues } = createService();

		expect(queues.deliverQueue.process).toHaveBeenCalledWith(64, expect.any(Function));
		expect(queues.inboxQueue.process).toHaveBeenCalledWith(8, expect.any(Function));
		expect(queues.relationshipQueue.process).toHaveBeenCalledWith('follow', 4, expect.any(Function));
		expect(queues.relationshipQueue.process).toHaveBeenCalledWith('unfollow', 4, expect.any(Function));
	});

	test('registers processors with default concurrency when not configured', () => {
		const { queues } = createService({
			deliverJobConcurrency: undefined,
			inboxJobConcurrency: undefined,
			relashionshipJobConcurrency: undefined,
		});

		expect(queues.deliverQueue.process).toHaveBeenCalledWith(128, expect.any(Function));
		expect(queues.inboxQueue.process).toHaveBeenCalledWith(16, expect.any(Function));
		expect(queues.relationshipQueue.process).toHaveBeenCalledWith('follow', 16, expect.any(Function));
	});

	test('registers scheduled jobs on system queue', () => {
		const { queues } = createService();

		expect(queues.systemQueue.add).toHaveBeenCalledWith('tickCharts', {}, { repeat: { cron: '55 * * * *' }, removeOnComplete: true });
		expect(queues.systemQueue.add).toHaveBeenCalledWith('resyncCharts', {}, { repeat: { cron: '0 0 * * *' }, removeOnComplete: true });
		expect(queues.systemQueue.add).toHaveBeenCalledWith('cleanCharts', {}, { repeat: { cron: '0 0 * * *' }, removeOnComplete: true });
		expect(queues.systemQueue.add).toHaveBeenCalledWith('aggregateRetention', {}, { repeat: { cron: '0 0 * * *' }, removeOnComplete: true });
		expect(queues.systemQueue.add).toHaveBeenCalledWith('clean', {}, { repeat: { cron: '0 0 * * *' }, removeOnComplete: true });
		expect(queues.systemQueue.add).toHaveBeenCalledWith('checkExpiredMutings', {}, { repeat: { cron: '*/5 * * * *' }, removeOnComplete: true });
	});

	test('stop closes all queues', async () => {
		const { service, queues } = createService();

		await service.stop();

		for (const queue of Object.values(queues)) {
			expect(queue.close).toHaveBeenCalledWith(false);
		}
	});

	test('onApplicationShutdown calls stop', async () => {
		const { service, queues } = createService();

		await service.onApplicationShutdown();

		for (const queue of Object.values(queues)) {
			expect(queue.close).toHaveBeenCalled();
		}
	});
});
