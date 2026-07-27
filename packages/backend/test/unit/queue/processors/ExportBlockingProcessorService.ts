process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ExportBlockingProcessorService } from '@/queue/processors/ExportBlockingProcessorService.js';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, BlockingsRepository, Blocking } from '@/models/index.js';
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

describe('ExportBlockingProcessorService', () => {
	let app: TestingModule;
	let service: ExportBlockingProcessorService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let blockingsRepository: jest.Mocked<BlockingsRepository>;
	let driveService: { addFile: jest.MockedFunction<DriveService['addFile']> };
	let utilityService: { getFullApAccount: jest.MockedFunction<UtilityService['getFullApAccount']> };
	let done: jest.Mock<() => void>;

	beforeEach(async () => {
		usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		blockingsRepository = {
			find: jest.fn(),
			countBy: jest.fn(),
		} as unknown as jest.Mocked<BlockingsRepository>;

		driveService = {
			addFile: jest.fn().mockResolvedValue({ id: 'drive-file-id' }),
		} as unknown as jest.Mocked<DriveService>;

		utilityService = {
			getFullApAccount: jest.fn((username, host) => host ? `${username}@${host}` : `${username}@example.com`),
		} as unknown as jest.Mocked<UtilityService>;

		const mockLogger = createMockLogger();

		app = await Test.createTestingModule({
			providers: [
				ExportBlockingProcessorService,
				{ provide: DI.config, useValue: { host: 'example.com' } as Config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.blockingsRepository, useValue: blockingsRepository },
				{ provide: DriveService, useValue: driveService },
				{ provide: UtilityService, useValue: utilityService },
				{ provide: QueueLoggerService, useValue: { logger: mockLogger } },
			],
		}).compile();

		service = app.get<ExportBlockingProcessorService>(ExportBlockingProcessorService);
		done = jest.fn();
	});

	afterEach(async () => {
		await app.close();
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
		expect(blockingsRepository.find).not.toHaveBeenCalled();
		expect(driveService.addFile).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('exports blockings as csv', async () => {
		const user = { id: 'user1', username: 'alice', host: null } as User;
		const blockee = { id: 'user2', username: 'bob', host: 'remote.example' } as User;

		usersRepository.findOneBy.mockImplementation(async (where: any) => {
			if (where.id === 'user1') return user;
			if (where.id === 'user2') return blockee;
			return null;
		});
		blockingsRepository.find
			.mockResolvedValueOnce([
				{ id: 'blocking1', blockerId: 'user1', blockeeId: 'user2' } as Blocking,
			])
			.mockResolvedValue([]);
		blockingsRepository.countBy.mockResolvedValue(1);

		await service.process(createJob({ user: { id: 'user1' } as User }), done);

		expect(blockingsRepository.find).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ blockerId: 'user1' }),
			take: 100,
			order: { id: 1 },
		}));
		expect(utilityService.getFullApAccount).toHaveBeenCalledWith('bob', 'remote.example');
		expect(driveService.addFile).toHaveBeenCalledWith(expect.objectContaining({
			user,
			name: expect.stringMatching(/^blocking-.*\.csv$/),
			force: true,
			ext: 'csv',
		}));
		expect(done).toHaveBeenCalledTimes(1);
	});
});
