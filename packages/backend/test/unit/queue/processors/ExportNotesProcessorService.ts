process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ExportNotesProcessorService } from '@/queue/processors/ExportNotesProcessorService.js';
import { DI } from '@/di-symbols.js';
import type { NotesRepository, PollsRepository, UsersRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import { DriveService } from '@/core/DriveService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import type { TestingModule } from '@nestjs/testing';
import type Bull from 'bull';
import type { DbJobDataWithUser } from '@/queue/types.js';
import { User } from '@/models/entities/User.js';
import { Note } from '@/models/entities/Note.js';
import { Poll } from '@/models/entities/Poll.js';

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

describe('ExportNotesProcessorService', () => {
	let app: TestingModule;
	let service: ExportNotesProcessorService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let notesRepository: jest.Mocked<NotesRepository>;
	let pollsRepository: jest.Mocked<PollsRepository>;
	let driveService: { addFile: jest.MockedFunction<DriveService['addFile']> };
	let driveFileEntityService: { packManyByIds: jest.MockedFunction<DriveFileEntityService['packManyByIds']> };
	let done: jest.Mock<() => void>;

	beforeEach(async () => {
		usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		notesRepository = {
			find: jest.fn(),
			countBy: jest.fn(),
		} as unknown as jest.Mocked<NotesRepository>;

		pollsRepository = {
			findOneByOrFail: jest.fn(),
		} as unknown as jest.Mocked<PollsRepository>;

		driveService = {
			addFile: jest.fn().mockResolvedValue({ id: 'drive-file-id' }),
		} as unknown as { addFile: jest.MockedFunction<DriveService['addFile']> };

		driveFileEntityService = {
			packManyByIds: jest.fn().mockResolvedValue([]),
		} as unknown as { packManyByIds: jest.MockedFunction<DriveFileEntityService['packManyByIds']> };

		const mockLogger = createMockLogger();

		app = await Test.createTestingModule({
			providers: [
				ExportNotesProcessorService,
				{ provide: DI.config, useValue: { host: 'example.com' } as Config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.pollsRepository, useValue: pollsRepository },
				{ provide: DI.notesRepository, useValue: notesRepository },
				{ provide: DriveService, useValue: driveService },
				{ provide: DriveFileEntityService, useValue: driveFileEntityService },
				{ provide: QueueLoggerService, useValue: { logger: mockLogger } },
			],
		}).compile();

		service = app.get<ExportNotesProcessorService>(ExportNotesProcessorService);
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
		expect(notesRepository.find).not.toHaveBeenCalled();
		expect(driveService.addFile).not.toHaveBeenCalled();
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('exports notes as json', async () => {
		const user = new User({ id: 'user1', username: 'alice', host: null });
		const note = new Note({
			id: 'note1',
			userId: user.id,
			text: 'hello world',
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

		usersRepository.findOneBy.mockResolvedValue(user);
		notesRepository.find
			.mockResolvedValueOnce([note])
			.mockResolvedValue([]);
		notesRepository.countBy.mockResolvedValue(1);

		const job = createJob({ user: { id: user.id } });
		await service.process(job, done);

		expect(notesRepository.find).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ userId: user.id }),
			take: 100,
			order: { id: 1 },
		}));
		expect(pollsRepository.findOneByOrFail).not.toHaveBeenCalled();
		expect(driveFileEntityService.packManyByIds).toHaveBeenCalledWith(note.fileIds);
		expect(driveService.addFile).toHaveBeenCalledWith(expect.objectContaining({
			user,
			name: expect.stringMatching(/^notes-.*\.json$/),
			force: true,
			ext: 'json',
		}));
		expect(job.progress).toHaveBeenCalledWith(1);
		expect(done).toHaveBeenCalledTimes(1);
	});

	test('exports notes with polls and files', async () => {
		const user = new User({ id: 'user1', username: 'alice', host: null });
		const note = new Note({
			id: 'note2',
			userId: user.id,
			text: 'poll note',
			createdAt: new Date('2024-01-02T00:00:00.000Z'),
			fileIds: ['file1'],
			hasPoll: true,
			replyId: null,
			renoteId: null,
			cw: null,
			visibility: 'public',
			visibleUserIds: [],
			localOnly: false,
			reactionAcceptance: null,
		});
		const poll = new Poll({
			noteId: note.id,
			choices: ['a', 'b'],
			votes: [0, 0],
			multiple: false,
			expiresAt: null,
			noteVisibility: 'public',
			userId: user.id,
			userHost: null,
		});

		usersRepository.findOneBy.mockResolvedValue(user);
		notesRepository.find
			.mockResolvedValueOnce([note])
			.mockResolvedValue([]);
		notesRepository.countBy.mockResolvedValue(1);
		pollsRepository.findOneByOrFail.mockResolvedValue(poll);

		const job = createJob({ user: { id: user.id } });
		await service.process(job, done);

		expect(pollsRepository.findOneByOrFail).toHaveBeenCalledWith({ noteId: note.id });
		expect(driveFileEntityService.packManyByIds).toHaveBeenCalledWith(note.fileIds);
		expect(driveService.addFile).toHaveBeenCalledWith(expect.objectContaining({
			user,
			name: expect.stringMatching(/^notes-.*\.json$/),
			force: true,
			ext: 'json',
		}));
		expect(job.progress).toHaveBeenCalledWith(1);
		expect(done).toHaveBeenCalledTimes(1);
	});
});
