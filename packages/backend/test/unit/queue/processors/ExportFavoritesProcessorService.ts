process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ExportFavoritesProcessorService } from '@/queue/processors/ExportFavoritesProcessorService.js';
import { DI } from '@/di-symbols.js';
import type { NoteFavoritesRepository, NotesRepository, PollsRepository, UsersRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import { DriveService } from '@/core/DriveService.js';
import { QueryService } from '@/core/QueryService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import { createMockQueryBuilder } from '../../../prelude/typeorm-query-builder-mock.js';
import type { TestingModule } from '@nestjs/testing';
import type Bull from 'bull';
import type { DbJobDataWithUser } from '@/queue/types.js';
import { User } from '@/models/entities/User.js';
import { Note } from '@/models/entities/Note.js';
import { Poll } from '@/models/entities/Poll.js';
import type { NoteFavorite } from '@/models/entities/NoteFavorite.js';

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

describe('ExportFavoritesProcessorService', () => {
	let app: TestingModule;
	let service: ExportFavoritesProcessorService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let noteFavoritesRepository: jest.Mocked<NoteFavoritesRepository>;
	let pollsRepository: jest.Mocked<PollsRepository>;
	let queryService: { generateVisibilityQuery: jest.Mock };
	let favoritesQuery: ReturnType<typeof createMockQueryBuilder>;
	let driveService: { addFile: jest.MockedFunction<DriveService['addFile']> };
	let done: jest.Mock<() => void>;

	beforeEach(async () => {
		usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		// The processor pages through favorites with a query builder so that the
		// visibility filter can be applied to every page.
		favoritesQuery = createMockQueryBuilder();
		noteFavoritesRepository = {
			createQueryBuilder: jest.fn(() => favoritesQuery),
			countBy: jest.fn(),
		} as unknown as jest.Mocked<NoteFavoritesRepository>;

		pollsRepository = {
			findOneByOrFail: jest.fn(),
		} as unknown as jest.Mocked<PollsRepository>;

		queryService = {
			generateVisibilityQuery: jest.fn(),
		};

		driveService = {
			addFile: jest.fn().mockResolvedValue({ id: 'drive-file-id' }),
		} as unknown as { addFile: jest.MockedFunction<DriveService['addFile']> };

		const mockLogger = createMockLogger();

		app = await Test.createTestingModule({
			providers: [
				ExportFavoritesProcessorService,
				{ provide: DI.config, useValue: { host: 'example.com' } as Config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.pollsRepository, useValue: pollsRepository },
				{ provide: DI.notesRepository, useValue: { find: jest.fn(), countBy: jest.fn() } as unknown as jest.Mocked<NotesRepository> },
				{ provide: DI.noteFavoritesRepository, useValue: noteFavoritesRepository },
				{ provide: QueryService, useValue: queryService },
				{ provide: DriveService, useValue: driveService },
				{ provide: QueueLoggerService, useValue: { logger: mockLogger } },
			],
		}).compile();

		service = app.get<ExportFavoritesProcessorService>(ExportFavoritesProcessorService);
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

		await service.process(createJob({ user: { id: 'user1' } }), done);

		expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: 'user1' });
		expect(noteFavoritesRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(driveService.addFile).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('exports favorites as json', async () => {
		const user = new User({ id: 'user1', username: 'alice', host: null });
		const noteUser = new User({ id: 'user2', username: 'bob', host: 'remote.example' });
		const note = new Note({
			id: 'note1',
			userId: noteUser.id,
			user: noteUser,
			text: 'favorite target',
			createdAt: new Date('2024-01-01T00:00:00.000Z'),
			fileIds: [],
			hasPoll: false,
			replyId: null,
			renoteId: null,
			cw: null,
			visibility: 'public',
			visibleUserIds: [],
			localOnly: false,
			reactionAcceptance: null,
		});
		const favorite = {
			id: 'favorite1',
			userId: user.id,
			noteId: note.id,
			note,
			createdAt: new Date('2024-01-01T00:00:00.000Z'),
			user: null,
		} as NoteFavorite;

		usersRepository.findOneBy.mockResolvedValue(user);
		favoritesQuery.getMany
			.mockResolvedValueOnce([favorite])
			.mockResolvedValue([]);
		noteFavoritesRepository.countBy.mockResolvedValue(1);

		const job = createJob({ user: { id: user.id } });
		await service.process(job, done);

		expect(noteFavoritesRepository.createQueryBuilder).toHaveBeenCalledWith('favorite');
		expect(favoritesQuery.where).toHaveBeenCalledWith('favorite.userId = :userId', { userId: user.id });
		expect(favoritesQuery.leftJoinAndSelect).toHaveBeenCalledWith('favorite.note', 'note');
		expect(favoritesQuery.leftJoinAndSelect).toHaveBeenCalledWith('note.user', 'user');
		// Favorites must be filtered by the visibility the exporting user is
		// actually allowed to see.
		expect(queryService.generateVisibilityQuery).toHaveBeenCalledWith(favoritesQuery, user);
		expect(pollsRepository.findOneByOrFail).not.toHaveBeenCalled();
		expect(driveService.addFile).toHaveBeenCalledWith(expect.objectContaining({
			user,
			name: expect.stringMatching(/^favorites-.*\.json$/),
			force: true,
			ext: 'json',
		}));
		expect(job.progress).toHaveBeenCalledWith(1);
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('exports favorites with polls', async () => {
		const user = new User({ id: 'user1', username: 'alice', host: null });
		const noteUser = new User({ id: 'user2', username: 'bob', host: 'remote.example' });
		const note = new Note({
			id: 'note2',
			userId: noteUser.id,
			user: noteUser,
			text: 'favorite poll',
			createdAt: new Date('2024-01-02T00:00:00.000Z'),
			fileIds: [],
			hasPoll: true,
			replyId: null,
			renoteId: null,
			cw: null,
			visibility: 'public',
			visibleUserIds: [],
			localOnly: false,
			reactionAcceptance: null,
		});
		const favorite = {
			id: 'favorite2',
			userId: user.id,
			noteId: note.id,
			note,
			createdAt: new Date('2024-01-02T00:00:00.000Z'),
			user: null,
		} as NoteFavorite;
		const poll = new Poll({
			noteId: note.id,
			choices: ['yes', 'no'],
			votes: [0, 0],
			multiple: false,
			expiresAt: null,
			noteVisibility: 'public',
			userId: noteUser.id,
			userHost: noteUser.host,
		});

		usersRepository.findOneBy.mockResolvedValue(user);
		favoritesQuery.getMany
			.mockResolvedValueOnce([favorite])
			.mockResolvedValue([]);
		noteFavoritesRepository.countBy.mockResolvedValue(1);
		pollsRepository.findOneByOrFail.mockResolvedValue(poll);

		const job = createJob({ user: { id: user.id } });
		await service.process(job, done);

		expect(pollsRepository.findOneByOrFail).toHaveBeenCalledWith({ noteId: note.id });
		expect(driveService.addFile).toHaveBeenCalledWith(expect.objectContaining({
			user,
			name: expect.stringMatching(/^favorites-.*\.json$/),
			force: true,
			ext: 'json',
		}));
		expect(job.progress).toHaveBeenCalledWith(1);
		expect(done).toHaveBeenCalledTimes(1);
	});
});
