process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ImportMutingProcessorService } from '@/queue/processors/ImportMutingProcessorService.js';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, DriveFilesRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UserMutingService } from '@/core/UserMutingService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import type { TestingModule } from '@nestjs/testing';
import type Bull from 'bull';
import type { DbUserImportJobData } from '@/queue/types.js';
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

describe('ImportMutingProcessorService', () => {
	let app: TestingModule;
	let service: ImportMutingProcessorService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let driveFilesRepository: jest.Mocked<DriveFilesRepository>;
	let downloadService: { downloadTextFile: jest.MockedFunction<DownloadService['downloadTextFile']> };
	let userMutingService: { mute: jest.MockedFunction<UserMutingService['mute']> };
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

		userMutingService = {
			mute: jest.fn(),
		} as unknown as { mute: jest.MockedFunction<UserMutingService['mute']> };

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
				ImportMutingProcessorService,
				{ provide: DI.config, useValue: { host: 'example.com' } as Config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.driveFilesRepository, useValue: driveFilesRepository },
				{ provide: DownloadService, useValue: downloadService },
				{ provide: UserMutingService, useValue: userMutingService },
				{ provide: RemoteUserResolveService, useValue: remoteUserResolveService },
				{ provide: UtilityService, useValue: utilityService },
				{ provide: QueueLoggerService, useValue: { logger: mockLogger } },
			],
		}).compile();

		service = app.get<ImportMutingProcessorService>(ImportMutingProcessorService);
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

	test('does nothing when user not found', async () => {
		usersRepository.findOneBy.mockResolvedValue(null);

		await service.process(createJob({ user: { id: 'user1' } as User, fileId: 'file1' }), done);

		expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: 'user1' });
		expect(driveFilesRepository.findOneBy).not.toHaveBeenCalled();
		expect(downloadService.downloadTextFile).not.toHaveBeenCalled();
		expect(userMutingService.mute).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('does nothing when file not found', async () => {
		const user = { id: 'user1' } as User;
		usersRepository.findOneBy.mockResolvedValue(user);
		driveFilesRepository.findOneBy.mockResolvedValue(null);

		await service.process(createJob({ user: { id: 'user1' } as User, fileId: 'file1' }), done);

		expect(driveFilesRepository.findOneBy).toHaveBeenCalledWith({ id: 'file1' });
		expect(downloadService.downloadTextFile).not.toHaveBeenCalled();
		expect(userMutingService.mute).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('mutes users from csv', async () => {
		const user = { id: 'user1', username: 'alice', host: null } as User;
		const file = { id: 'file1', url: 'https://example.com/muting.csv' } as DriveFile;
		const target = { id: 'user2', username: 'bob', host: 'remote.example' } as User;
		usersRepository.findOneBy.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
		driveFilesRepository.findOneBy.mockResolvedValue(file);
		downloadService.downloadTextFile.mockResolvedValue('bob@remote.example\n');
		remoteUserResolveService.resolveUser.mockResolvedValue(target);

		await service.process(createJob({ user: { id: 'user1' } as User, fileId: 'file1' }), done);

		expect(downloadService.downloadTextFile).toHaveBeenCalledWith('https://example.com/muting.csv');
		expect(usersRepository.findOneBy).toHaveBeenCalledWith({
			host: 'remote.example',
			usernameLower: 'bob',
		});
		expect(remoteUserResolveService.resolveUser).toHaveBeenCalledWith('bob', 'remote.example');
		expect(userMutingService.mute).toHaveBeenCalledWith(user, target);
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('skips self', async () => {
		const user = { id: 'user1', username: 'alice', host: null } as User;
		const file = { id: 'file1', url: 'https://example.com/muting.csv' } as DriveFile;
		const target = { id: 'user1', username: 'alice', host: 'remote.example' } as User;
		usersRepository.findOneBy.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
		driveFilesRepository.findOneBy.mockResolvedValue(file);
		downloadService.downloadTextFile.mockResolvedValue('alice@remote.example\n');
		remoteUserResolveService.resolveUser.mockResolvedValue(target);

		await service.process(createJob({ user: { id: 'user1' } as User, fileId: 'file1' }), done);

		expect(userMutingService.mute).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('skips lines without a remote host', async () => {
		const user = { id: 'user1', username: 'alice', host: null } as User;
		const file = { id: 'file1', url: 'https://example.com/muting.csv' } as DriveFile;
		usersRepository.findOneBy.mockResolvedValue(user);
		driveFilesRepository.findOneBy.mockResolvedValue(file);
		downloadService.downloadTextFile.mockResolvedValue('bob\n');

		await service.process(createJob({ user: { id: 'user1' } as User, fileId: 'file1' }), done);

		expect(userMutingService.mute).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});
});
