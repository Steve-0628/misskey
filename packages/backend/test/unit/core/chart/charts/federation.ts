process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import FederationChart from '@/core/chart/charts/federation.js';
import type { DataSource } from 'typeorm';
import type { FollowingsRepository, InstancesRepository } from '@/models/index.js';
import type { MetaService } from '@/core/MetaService.js';
import type { AppLockService } from '@/core/AppLockService.js';
import type { ChartLoggerService } from '@/core/chart/ChartLoggerService.js';

describe('FederationChart', () => {
	function createChart() {
		const commit = jest.fn().mockResolvedValue(undefined);

		const db = {
			getRepository: jest.fn().mockReturnValue({}),
		} as unknown as DataSource;

		const chart = new FederationChart(
			db,
			{} as FollowingsRepository,
			{} as InstancesRepository,
			{ fetch: jest.fn().mockResolvedValue({ blockedHosts: [] }) } as unknown as MetaService,
			{ getChartInsertLock: jest.fn() } as unknown as AppLockService,
			{ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } } as unknown as ChartLoggerService,
		);

		(chart as any).commit = commit;

		return { chart, commit };
	}

	test('delivered commits deliveredInstances on success', async () => {
		const { chart, commit } = createChart();

		await chart.deliverd('example.com', true);

		expect(commit).toHaveBeenCalledWith({ deliveredInstances: ['example.com'] });
	});

	test('delivered commits stalled on failure', async () => {
		const { chart, commit } = createChart();

		await chart.deliverd('example.com', false);

		expect(commit).toHaveBeenCalledWith({ stalled: ['example.com'] });
	});

	test('inbox commits inboxInstances', async () => {
		const { chart, commit } = createChart();

		await chart.inbox('example.com');

		expect(commit).toHaveBeenCalledWith({ inboxInstances: ['example.com'] });
	});
});
