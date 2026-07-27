process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { DeliverProcessorService } from '@/queue/processors/DeliverProcessorService.js';
import type { Config } from '@/config.js';
import type { InstancesRepository, DriveFilesRepository } from '@/models/index.js';
import type { MetaService } from '@/core/MetaService.js';
import type { ApRequestService } from '@/core/activitypub/ApRequestService.js';
import type { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import type { FetchInstanceMetadataService } from '@/core/FetchInstanceMetadataService.js';
import type InstanceChart from '@/core/chart/charts/instance.js';
import type ApRequestChart from '@/core/chart/charts/ap-request.js';
import type FederationChart from '@/core/chart/charts/federation.js';
import type { UtilityService } from '@/core/UtilityService.js';
import type { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import { StatusError } from '@/misc/status-error.js';
import type Logger from '@/logger.js';

describe('DeliverProcessorService', () => {
	function createService() {
		const logger = {
			createSubLogger: jest.fn().mockReturnThis(),
		} as unknown as Logger;

		const queueLoggerService = { logger } as unknown as QueueLoggerService;

		const config = {} as Config;

		const metaService = {
			fetch: jest.fn().mockResolvedValue({ blockedHosts: [], enableChartsForFederatedInstances: false }),
		} as unknown as MetaService;

		const utilityService = {
			toPuny: (h: string) => h,
			isBlockedHost: jest.fn().mockReturnValue(false),
		} as unknown as UtilityService;

		const instancesRepository = {
			find: jest.fn().mockResolvedValue([]),
		} as unknown as InstancesRepository;

		const driveFilesRepository = {} as DriveFilesRepository;

		const apRequestService = {
			signedPost: jest.fn(),
		} as unknown as ApRequestService;

		const federatedInstanceService = {
			fetch: jest.fn().mockResolvedValue({ id: 'instance1', host: 'remote.example', isNotResponding: false }),
			update: jest.fn().mockResolvedValue(undefined),
		} as unknown as FederatedInstanceService;

		const fetchInstanceMetadataService = {
			fetchInstanceMetadata: jest.fn(),
		} as unknown as FetchInstanceMetadataService;

		const instanceChart = {
			requestSent: jest.fn(),
		} as unknown as InstanceChart;

		const apRequestChart = {
			deliverSucc: jest.fn(),
			deliverFail: jest.fn(),
		} as unknown as ApRequestChart;

		const federationChart = {
			deliverd: jest.fn(),
		} as unknown as FederationChart;

		const service = new DeliverProcessorService(
			config,
			instancesRepository,
			driveFilesRepository,
			metaService,
			utilityService,
			federatedInstanceService,
			fetchInstanceMetadataService,
			apRequestService,
			instanceChart,
			apRequestChart,
			federationChart,
			queueLoggerService,
		);

		return {
			service,
			mocks: {
				metaService,
				utilityService,
				instancesRepository,
				apRequestService,
				federatedInstanceService,
				fetchInstanceMetadataService,
				instanceChart,
				apRequestChart,
				federationChart,
			},
		};
	}

	function createJob(data: any): any {
		return { data };
	}

	test('skips blocked host', async () => {
		const { service, mocks } = createService();
		mocks.utilityService.isBlockedHost = jest.fn().mockReturnValue(true);

		const result = await service.process(createJob({ to: 'https://blocked.example/inbox', user: {}, content: {} }));

		expect(result).toBe('skip (blocked)');
		expect(mocks.apRequestService.signedPost).not.toHaveBeenCalled();
	});

	test('skips suspended host', async () => {
		const { service, mocks } = createService();
		mocks.instancesRepository.find = jest.fn().mockResolvedValue([{ host: 'suspended.example' }]);

		const result = await service.process(createJob({ to: 'https://suspended.example/inbox', user: {}, content: {} }));

		expect(result).toBe('skip (suspended)');
		expect(mocks.apRequestService.signedPost).not.toHaveBeenCalled();
	});

	test('returns success on delivery', async () => {
		const { service, mocks } = createService();
		mocks.apRequestService.signedPost.mockResolvedValue(undefined);

		const result = await service.process(createJob({ to: 'https://remote.example/inbox', user: {}, content: {} }));

		expect(result).toBe('Success');
		expect(mocks.federationChart.deliverd).toHaveBeenCalledWith('remote.example', true);
		expect(mocks.apRequestChart.deliverSucc).toHaveBeenCalled();
	});

	test('returns client error message for 4xx', async () => {
		const { service, mocks } = createService();
		mocks.apRequestService.signedPost.mockRejectedValue(new StatusError('Not Found', 404, 'Not Found'));
		mocks.federatedInstanceService.fetch = jest.fn().mockResolvedValue({ id: 'instance1', host: 'remote.example', isNotResponding: true });

		const result = await service.process(createJob({ to: 'https://remote.example/inbox', user: {}, content: {} }));

		expect(result).toBe('404 Not Found');
		expect(mocks.federationChart.deliverd).toHaveBeenCalledWith('remote.example', false);
	});

	test('throws on 410 shared inbox', async () => {
		const { service, mocks } = createService();
		mocks.apRequestService.signedPost.mockRejectedValue(new StatusError('Gone', 410, 'Gone'));

		await expect(service.process(createJob({ to: 'https://remote.example/inbox', user: {}, content: {}, isSharedInbox: true }))).rejects.toThrow('410 Gone');
	});

	test('throws on 5xx status error', async () => {
		const { service, mocks } = createService();
		mocks.apRequestService.signedPost.mockRejectedValue(new StatusError('Internal Server Error', 500, 'Internal Server Error'));

		await expect(service.process(createJob({ to: 'https://remote.example/inbox', user: {}, content: {} }))).rejects.toThrow('500 Internal Server Error');
	});

	test('throws non-StatusError as-is', async () => {
		const { service, mocks } = createService();
		const err = new Error('network failure');
		mocks.apRequestService.signedPost.mockRejectedValue(err);

		await expect(service.process(createJob({ to: 'https://remote.example/inbox', user: {}, content: {} }))).rejects.toBe(err);
	});
});
