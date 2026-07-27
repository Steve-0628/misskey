process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { TickChartsProcessorService } from '@/queue/processors/TickChartsProcessorService.js';
import type { Config } from '@/config.js';
import type { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import type Logger from '@/logger.js';

describe('TickChartsProcessorService', () => {
	function createService(): {
		service: TickChartsProcessorService;
		charts: Record<string, { tick: jest.Mock }>;
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
			'perUserPvChart',
			'driveChart',
			'perUserReactionsChart',
			'perUserFollowingChart',
			'perUserDriveChart',
			'apRequestChart',
		];

		const charts: Record<string, { tick: jest.Mock }> = {};
		for (const name of chartNames) {
			charts[name] = { tick: jest.fn().mockResolvedValue(undefined) };
		}

		const service = new TickChartsProcessorService(
			config,
			charts.federationChart as any,
			charts.notesChart as any,
			charts.usersChart as any,
			charts.activeUsersChart as any,
			charts.instanceChart as any,
			charts.perUserNotesChart as any,
			charts.perUserPvChart as any,
			charts.driveChart as any,
			charts.perUserReactionsChart as any,
			charts.perUserFollowingChart as any,
			charts.perUserDriveChart as any,
			charts.apRequestChart as any,
			queueLoggerService,
		);

		return { service, charts, done: jest.fn(), logger };
	}

	test('ticks all charts with false parameter and calls done', async () => {
		const { service, charts, done, logger } = createService();
		const job = { data: {} } as any;

		await service.process(job, done);

		for (const chart of Object.values(charts)) {
			expect(chart.tick).toHaveBeenCalledWith(false);
		}
		expect(logger.info).toHaveBeenCalledWith('Tick charts...');
		expect(logger.succ).toHaveBeenCalledWith('All charts successfully ticked.');
		expect(done).toHaveBeenCalled();
	});
});
