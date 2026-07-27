process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { ResyncChartsProcessorService } from '@/queue/processors/ResyncChartsProcessorService.js';
import type { Config } from '@/config.js';
import type { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import type Logger from '@/logger.js';

describe('ResyncChartsProcessorService', () => {
	function createService(): {
		service: ResyncChartsProcessorService;
		charts: Record<string, { resync: jest.Mock }>;
		done: jest.Mock;
		logger: Logger;
	} {
		const logger = {
			info: jest.fn(),
			succ: jest.fn(),
			createSubLogger: jest.fn().mockReturnThis(),
		} as unknown as Logger;

		const queueLoggerService = {
			logger,
		} as unknown as QueueLoggerService;

		const config = {} as Config;

		const chartNames = [
			'federationChart',
			'notesChart',
			'usersChart',
			'activeUsersChart',
			'instanceChart',
			'perUserNotesChart',
			'driveChart',
			'perUserReactionsChart',
			'perUserFollowingChart',
			'perUserDriveChart',
			'apRequestChart',
		];

		const charts: Record<string, { resync: jest.Mock }> = {};
		for (const name of chartNames) {
			charts[name] = { resync: jest.fn().mockResolvedValue(undefined) };
		}

		const service = new ResyncChartsProcessorService(
			config,
			charts.federationChart as any,
			charts.notesChart as any,
			charts.usersChart as any,
			charts.activeUsersChart as any,
			charts.instanceChart as any,
			charts.perUserNotesChart as any,
			charts.driveChart as any,
			charts.perUserReactionsChart as any,
			charts.perUserFollowingChart as any,
			charts.perUserDriveChart as any,
			charts.apRequestChart as any,
			queueLoggerService,
		);

		return { service, charts, done: jest.fn(), logger };
	}

	test('resyncs drive, notes, and users charts and calls done', async () => {
		const { service, charts, done, logger } = createService();
		const job = { data: {} } as any;

		await service.process(job, done);

		expect(charts.driveChart.resync).toHaveBeenCalled();
		expect(charts.notesChart.resync).toHaveBeenCalled();
		expect(charts.usersChart.resync).toHaveBeenCalled();

		expect(charts.federationChart.resync).not.toHaveBeenCalled();
		expect(charts.activeUsersChart.resync).not.toHaveBeenCalled();

		expect(logger.info).toHaveBeenCalledWith('Resync charts...');
		expect(logger.succ).toHaveBeenCalledWith('All charts successfully resynced.');
		expect(done).toHaveBeenCalled();
	});
});
