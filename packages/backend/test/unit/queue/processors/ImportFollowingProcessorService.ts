process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ImportFollowingProcessorService } from '@/queue/processors/ImportFollowingProcessorService.js';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, DriveFilesRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { QueueService } from '@/core/QueueService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import type { TestingModule } from '@nestjs/testing';
import type Bull from 'bull';
import type { DbUserImportJobData, DbUserImportToDbJobData } from '@/queue/types.js';
import type { User } from '@/models/entities/User.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';

function createMockLogger() {
	return {
		info: jest.fn(),
		succ: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
		createSubLogger: jest.fn().mockReturnValue({
			info: jest.fn(),
			succ: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		}),
	};
}

describe('ImportFollowingProcessorService', () => {
	let app: TestingModule;
	let service: ImportFollowingProcessorService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let driveFilesRepository: jest.Mocked<DriveFilesRepository>;
	let downloadService: { downloadTextFile: jest.MockedFunction<DownloadService['downloadTextFile']> };
	let queueService: {
		createImportFollowingToDbJob: jest.MockedFunction<QueueService['createImportFollowingToDbJob']>;
		createFollowJob: jest.MockedFunction<QueueService['createFollowJob']>;
	};
	let remoteUserResolveService: { resolveUser: jest.MockedFunction<RemoteUserResolveService['resolveUser']> };
	let utilityService: {
		isSelfHost: jest.MockedFunction<UtilityService['isSelfHost']>;
		toPuny: jest.MockedFunction<UtilityService['toPuny']>;
	};
	let done: jest.Mock<() => void>;

	beforeEach(async () => {
		usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		driveFilesRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<DriveFilesRepository>;

		downloadService = {
			downloadTextFile: jest.fn(),
		} as unknown as { downloadTextFile: jest.MockedFunction<DownloadService['downloadTextFile']> };

		queueService = {
			createImportFollowingToDbJob: jest.fn(),
			createFollowJob: jest.fn(),
		} as unknown as {
			createImportFollowingToDbJob: jest.MockedFunction<QueueService['createImportFollowingToDbJob']>;
			createFollowJob: jest.MockedFunction<QueueService['createFollowJob']>;
		};

		remoteUserResolveService = {
			resolveUser: jest.fn(),
		} as unknown as { resolveUser: jest.MockedFunction<RemoteUserResolveService['resolveUser']> };

		utilityService = {
			isSelfHost: jest.fn().mockReturnValue(false),
			toPuny: jest.fn((host: string) => host),
		} as unknown as {
			isSelfHost: jest.MockedFunction<UtilityService['isSelfHost']>;
			toPuny: jest.MockedFunction<UtilityService['toPuny']>;
		};

		const mockLogger = createMockLogger();

		app = await Test.createTestingModule({
			providers: [
				ImportFollowingProcessorService,
				{ provide: DI.config, useValue: { host: 'example.com' } as Config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.driveFilesRepository, useValue: driveFilesRepository },
				{ provide: DownloadService, useValue: downloadService },
				{ provide: QueueService, useValue: queueService },
				{ provide: RemoteUserResolveService, useValue: remoteUserResolveService },
				{ provide: UtilityService, useValue: utilityService },
				{ provide: QueueLoggerService, useValue: { logger: mockLogger } },
			],
		}).compile();

		service = app.get<ImportFollowingProcessorService>(ImportFollowingProcessorService);
		done = jest.fn();
	});

	afterEach(async () => {
		await app.close();
	});

	function createJob(data: DbUserImportJobData): Bull.Job<DbUserImportJobData> {
		return {
			data,
			progress: jest.fn(),
		} as unknown as Bull.Job<DbUserImportJobData>;
	}

	function createDbJob(data: DbUserImportToDbJobData): Bull.Job<DbUserImportToDbJobData> {
		return {
			data,
			progress: jest.fn(),
		} as unknown as Bull.Job<DbUserImportToDbJobData>;
	}

	test('does nothing when user not found', async () => {
		usersRepository.findOneBy.mockResolvedValue(null);

		await service.process(createJob({ user: { id: 'user1' } as User, fileId: 'file1' }), done);

		expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: 'user1' });
		expect(driveFilesRepository.findOneBy).not.toHaveBeenCalled();
		expect(downloadService.downloadTextFile).not.toHaveBeenCalled();
		expect(queueService.createImportFollowingToDbJob).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('does nothing when file not found', async () => {
		const user = { id: 'user1' } as User;
		usersRepository.findOneBy.mockResolvedValue(user);
		driveFilesRepository.findOneBy.mockResolvedValue(null);

		await service.process(createJob({ user: { id: 'user1' } as User, fileId: 'file1' }), done);

		expect(driveFilesRepository.findOneBy).toHaveBeenCalledWith({ id: 'file1' });
		expect(downloadService.downloadTextFile).not.toHaveBeenCalled();
		expect(queueService.createImportFollowingToDbJob).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('creates import-to-db jobs from csv', async () => {
		const user = { id: 'user1' } as User;
		const file = { id: 'file1', url: 'https://example.com/following.csv' } as DriveFile;
		usersRepository.findOneBy.mockResolvedValue(user);
		driveFilesRepository.findOneBy.mockResolvedValue(file);
		downloadService.downloadTextFile.mockResolvedValue('bob@remote.example\ncharlie@remote.example\n');

		await service.process(createJob({ user: { id: 'user1' } as User, fileId: 'file1' }), done);

		expect(downloadService.downloadTextFile).toHaveBeenCalledWith('https://example.com/following.csv');
		expect(queueService.createImportFollowingToDbJob).toHaveBeenCalledWith(
			{ id: 'user1' },
			['bob@remote.example', 'charlie@remote.example'],
		);
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('processDb resolves remote user and creates follow job', async () => {
		const user = { id: 'user1' } as User;
		const target = { id: 'user2', username: 'bob', host: 'remote.example' } as User;
		usersRepository.findOneBy.mockResolvedValue(null);
		remoteUserResolveService.resolveUser.mockResolvedValue(target);

		await service.processDb(createDbJob({ user: { id: 'user1' }, target: 'bob@remote.example' }));

		expect(utilityService.isSelfHost).toHaveBeenCalledWith('remote.example');
		expect(usersRepository.findOneBy).toHaveBeenCalledWith({
			host: 'remote.example',
			usernameLower: 'bob',
		});
		expect(remoteUserResolveService.resolveUser).toHaveBeenCalledWith('bob', 'remote.example');
		expect(queueService.createFollowJob).toHaveBeenCalledWith([
			{ from: { id: 'user1' }, to: { id: 'user2' }, silent: true },
		]);
	});

	test('processDb uses local user when available', async () => {
		const user = { id: 'user1' } as User;
		const target = { id: 'user2', username: 'bob', host: 'remote.example' } as User;
		usersRepository.findOneBy.mockResolvedValue(target);

		await service.processDb(createDbJob({ user: { id: 'user1' }, target: 'bob@remote.example' }));

		expect(remoteUserResolveService.resolveUser).not.toHaveBeenCalled();
		expect(queueService.createFollowJob).toHaveBeenCalledWith([
			{ from: { id: 'user1' }, to: { id: 'user2' }, silent: true },
		]);
	});

	test('processDb skips self', async () => {
		const target = { id: 'user1', username: 'alice', host: 'remote.example' } as User;
		usersRepository.findOneBy.mockResolvedValue(null);
		remoteUserResolveService.resolveUser.mockResolvedValue(target);

		await service.processDb(createDbJob({ user: { id: 'user1' }, target: 'alice@remote.example' }));

		expect(queueService.createFollowJob).not.toHaveBeenCalled();
	});

	test('processDb skips lines without a remote host', async () => {
		await service.processDb(createDbJob({ user: { id: 'user1' }, target: 'bob' }));

		expect(usersRepository.findOneBy).not.toHaveBeenCalled();
		expect(remoteUserResolveService.resolveUser).not.toHaveBeenCalled();
		expect(queueService.createFollowJob).not.toHaveBeenCalled();
	});
});
