process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ExportFollowingProcessorService } from '@/queue/processors/ExportFollowingProcessorService.js';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, FollowingsRepository, MutingsRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import { DriveService } from '@/core/DriveService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import type { TestingModule } from '@nestjs/testing';
import type Bull from 'bull';
import type { DbExportFollowingData } from '@/queue/types.js';
import type { User } from '@/models/entities/User.js';
import type { Following } from '@/models/entities/Following.js';
import type { Muting } from '@/models/entities/Muting.js';

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

describe('ExportFollowingProcessorService', () => {
	let app: TestingModule;
	let service: ExportFollowingProcessorService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let followingsRepository: jest.Mocked<FollowingsRepository>;
	let mutingsRepository: jest.Mocked<MutingsRepository>;
	let driveService: { addFile: jest.MockedFunction<DriveService['addFile']> };
	let utilityService: { getFullApAccount: jest.MockedFunction<UtilityService['getFullApAccount']> };
	let done: jest.Mock<() => void>;

	beforeEach(async () => {
		usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		followingsRepository = {
			find: jest.fn(),
		} as unknown as jest.Mocked<FollowingsRepository>;

		mutingsRepository = {
			findBy: jest.fn(),
		} as unknown as jest.Mocked<MutingsRepository>;

		driveService = {
			addFile: jest.fn().mockResolvedValue({ id: 'drive-file-id' }),
		} as unknown as jest.Mocked<DriveService>;

		utilityService = {
			getFullApAccount: jest.fn((username, host) => host ? `${username}@${host}` : `${username}@example.com`),
		} as unknown as jest.Mocked<UtilityService>;

		const mockLogger = createMockLogger();

		app = await Test.createTestingModule({
			providers: [
				ExportFollowingProcessorService,
				{ provide: DI.config, useValue: { host: 'example.com' } as Config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.followingsRepository, useValue: followingsRepository },
				{ provide: DI.mutingsRepository, useValue: mutingsRepository },
				{ provide: DriveService, useValue: driveService },
				{ provide: UtilityService, useValue: utilityService },
				{ provide: QueueLoggerService, useValue: { logger: mockLogger } },
			],
		}).compile();

		service = app.get<ExportFollowingProcessorService>(ExportFollowingProcessorService);
		done = jest.fn();
	});

	afterEach(async () => {
		await app.close();
	});

	function createJob(data: DbExportFollowingData): Bull.Job<DbExportFollowingData> {
		return {
			data,
			progress: jest.fn(),
		} as unknown as Bull.Job<DbExportFollowingData>;
	}

	test('does nothing when user not found', async () => {
		usersRepository.findOneBy.mockResolvedValue(null);

		await service.process(createJob({ user: { id: 'user1' } as User, excludeMuting: false, excludeInactive: false }), done);

		expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: 'user1' });
		expect(followingsRepository.find).not.toHaveBeenCalled();
		expect(driveService.addFile).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('exports following as csv', async () => {
		const user = { id: 'user1', username: 'alice', host: null } as User;
		const followee = { id: 'user2', username: 'bob', host: 'remote.example', updatedAt: new Date() } as User;

		usersRepository.findOneBy.mockImplementation(async (where: any) => {
			if (where.id === 'user1') return user;
			if (where.id === 'user2') return followee;
			return null;
		});
		followingsRepository.find
			.mockResolvedValueOnce([
				{ id: 'following1', followerId: 'user1', followeeId: 'user2' } as Following,
			])
			.mockResolvedValue([]);
		mutingsRepository.findBy.mockResolvedValue([]);

		await service.process(createJob({ user: { id: 'user1' } as User, excludeMuting: false, excludeInactive: false }), done);

		expect(followingsRepository.find).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ followerId: 'user1' }),
			take: 100,
			order: { id: 1 },
		}));
		expect(utilityService.getFullApAccount).toHaveBeenCalledWith('bob', 'remote.example');
		expect(driveService.addFile).toHaveBeenCalledWith(expect.objectContaining({
			user,
			name: expect.stringMatching(/^following-.*\.csv$/),
			force: true,
			ext: 'csv',
		}));
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('excludes muting users when requested', async () => {
		const user = { id: 'user1', username: 'alice', host: null } as User;

		usersRepository.findOneBy.mockResolvedValue(user);
		followingsRepository.find.mockResolvedValue([]);
		mutingsRepository.findBy.mockResolvedValue([
			{ id: 'muting1', muterId: 'user1', muteeId: 'user2' } as Muting,
		]);

		await service.process(createJob({ user: { id: 'user1' } as User, excludeMuting: true, excludeInactive: false }), done);

		expect(mutingsRepository.findBy).toHaveBeenCalledWith({ muterId: 'user1' });
		expect(followingsRepository.find).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({
				followerId: 'user1',
				followeeId: expect.anything(),
			}),
		}));
		expect(utilityService.getFullApAccount).not.toHaveBeenCalled();
		expect(driveService.addFile).toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('excludes inactive users when requested', async () => {
		const user = { id: 'user1', username: 'alice', host: null } as User;
		const inactiveFollowee = { id: 'user2', username: 'bob', host: null, updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 91 * 1000) } as User;

		usersRepository.findOneBy.mockImplementation(async (where: any) => {
			if (where.id === 'user1') return user;
			if (where.id === 'user2') return inactiveFollowee;
			return null;
		});
		followingsRepository.find
			.mockResolvedValueOnce([
				{ id: 'following1', followerId: 'user1', followeeId: 'user2' } as Following,
			])
			.mockResolvedValue([]);
		mutingsRepository.findBy.mockResolvedValue([]);

		await service.process(createJob({ user: { id: 'user1' } as User, excludeMuting: false, excludeInactive: true }), done);

		expect(utilityService.getFullApAccount).not.toHaveBeenCalled();
		expect(driveService.addFile).toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});
});
