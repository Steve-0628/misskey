process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ExportMutingProcessorService } from '@/queue/processors/ExportMutingProcessorService.js';
import { DI } from '@/di-symbols.js';
import type { MutingsRepository, UsersRepository, BlockingsRepository, Muting } from '@/models/index.js';
import type { Config } from '@/config.js';
import { DriveService } from '@/core/DriveService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import type { TestingModule } from '@nestjs/testing';
import type Bull from 'bull';
import type { DbJobDataWithUser } from '@/queue/types.js';
import type { User } from '@/models/entities/User.js';

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

describe('ExportMutingProcessorService', () => {
	let app: TestingModule;
	let service: ExportMutingProcessorService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let mutingsRepository: jest.Mocked<MutingsRepository>;
	let blockingsRepository: jest.Mocked<BlockingsRepository>;
	let driveService: { addFile: jest.MockedFunction<DriveService['addFile']> };
	let utilityService: { getFullApAccount: jest.MockedFunction<UtilityService['getFullApAccount']> };
	let done: jest.Mock<() => void>;

	beforeEach(async () => {
		usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		mutingsRepository = {
			find: jest.fn(),
			countBy: jest.fn(),
		} as unknown as jest.Mocked<MutingsRepository>;

		blockingsRepository = {} as unknown as jest.Mocked<BlockingsRepository>;

		driveService = {
			addFile: jest.fn().mockResolvedValue({ id: 'drive-file-id' }),
		} as unknown as { addFile: jest.MockedFunction<DriveService['addFile']> };

		utilityService = {
			getFullApAccount: jest.fn((username, host) => host ? `${username}@${host}` : `${username}@example.com`),
		} as unknown as { getFullApAccount: jest.MockedFunction<UtilityService['getFullApAccount']> };

		const mockLogger = createMockLogger();

		app = await Test.createTestingModule({
			providers: [
				ExportMutingProcessorService,
				{ provide: DI.config, useValue: { host: 'example.com' } as Config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.blockingsRepository, useValue: blockingsRepository },
				{ provide: DI.mutingsRepository, useValue: mutingsRepository },
				{ provide: DriveService, useValue: driveService },
				{ provide: UtilityService, useValue: utilityService },
				{ provide: QueueLoggerService, useValue: { logger: mockLogger } },
			],
		}).compile();

		service = app.get<ExportMutingProcessorService>(ExportMutingProcessorService);
		done = jest.fn();
	});

	afterEach(async () => {
		if (app) await app.close();
	});

	function createJob(data: DbJobDataWithUser): Bull.Job<DbJobDataWithUser> {
		return {
			data,
			progress: jest.fn(),
		} as unknown as Bull.Job<DbJobDataWithUser>;
	}

	test('does nothing when user not found', async () => {
		usersRepository.findOneBy.mockResolvedValue(null);

		await service.process(createJob({ user: { id: 'user1' } as User }), done);

		expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: 'user1' });
		expect(mutingsRepository.find).not.toHaveBeenCalled();
		expect(driveService.addFile).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('exports mutings as csv', async () => {
		const user = { id: 'user1', username: 'alice', host: null } as User;
		const mutee = { id: 'user2', username: 'bob', host: 'remote.example' } as User;

		usersRepository.findOneBy.mockImplementation(async (where: { id?: string }) => {
			if (where.id === 'user1') return user;
			if (where.id === 'user2') return mutee;
			return null;
		});
		mutingsRepository.find
			.mockResolvedValueOnce([
				{ id: 'muting1', muterId: 'user1', muteeId: 'user2', expiresAt: null } as Muting,
			])
			.mockResolvedValue([]);
		mutingsRepository.countBy.mockResolvedValue(1);

		await service.process(createJob({ user: { id: 'user1' } as User }), done);

		expect(mutingsRepository.find).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({
				muterId: 'user1',
				expiresAt: expect.anything(),
			}),
			take: 100,
			order: { id: 1 },
		}));
		expect(utilityService.getFullApAccount).toHaveBeenCalledWith('bob', 'remote.example');
		expect(driveService.addFile).toHaveBeenCalledWith(expect.objectContaining({
			user,
			name: expect.stringMatching(/^mute-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/),
			force: true,
			ext: 'csv',
		}));
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('paginates through mutings until no more results', async () => {
		const user = { id: 'user1', username: 'alice', host: null } as User;
		const mutee1 = { id: 'user2', username: 'bob', host: 'remote.example' } as User;
		const mutee2 = { id: 'user3', username: 'carol', host: null } as User;

		usersRepository.findOneBy.mockImplementation(async (where: { id?: string }) => {
			if (where.id === 'user1') return user;
			if (where.id === 'user2') return mutee1;
			if (where.id === 'user3') return mutee2;
			return null;
		});
		mutingsRepository.find
			.mockResolvedValueOnce([
				{ id: 'muting1', muterId: 'user1', muteeId: 'user2', expiresAt: null } as Muting,
				{ id: 'muting2', muterId: 'user1', muteeId: 'user3', expiresAt: null } as Muting,
			])
			.mockResolvedValue([]);
		mutingsRepository.countBy.mockResolvedValue(2);

		const job = createJob({ user: { id: 'user1' } as User });
		await service.process(job, done);

		expect(mutingsRepository.find).toHaveBeenCalledTimes(2);
		expect(utilityService.getFullApAccount).toHaveBeenCalledTimes(2);
		expect(job.progress).toHaveBeenCalledWith(1);
		expect(driveService.addFile).toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});
});
