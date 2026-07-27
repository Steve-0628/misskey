process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { DeleteAccountProcessorService } from '@/queue/processors/DeleteAccountProcessorService.js';
import { DI } from '@/di-symbols.js';
import type { DriveFilesRepository, NotesRepository, UserProfilesRepository, UsersRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import { DriveService } from '@/core/DriveService.js';
import { EmailService } from '@/core/EmailService.js';
import { SearchService } from '@/core/SearchService.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import type { TestingModule } from '@nestjs/testing';
import type Bull from 'bull';
import type { DbUserDeleteJobData } from '@/queue/types.js';
import { User } from '@/models/entities/User.js';
import { Note } from '@/models/entities/Note.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import type { UserProfile } from '@/models/entities/UserProfile.js';

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

describe('DeleteAccountProcessorService', () => {
	let app: TestingModule;
	let service: DeleteAccountProcessorService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let userProfilesRepository: jest.Mocked<UserProfilesRepository>;
	let notesRepository: jest.Mocked<NotesRepository>;
	let driveFilesRepository: jest.Mocked<DriveFilesRepository>;
	let driveService: { deleteFileSync: jest.MockedFunction<DriveService['deleteFileSync']> };
	let emailService: { sendEmail: jest.MockedFunction<EmailService['sendEmail']> };
	let searchService: { unindexNote: jest.MockedFunction<SearchService['unindexNote']> };

	beforeEach(async () => {
		usersRepository = {
			findOneBy: jest.fn(),
			delete: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		userProfilesRepository = {
			findOneByOrFail: jest.fn(),
		} as unknown as jest.Mocked<UserProfilesRepository>;

		notesRepository = {
			find: jest.fn(),
			delete: jest.fn(),
		} as unknown as jest.Mocked<NotesRepository>;

		driveFilesRepository = {
			find: jest.fn(),
		} as unknown as jest.Mocked<DriveFilesRepository>;

		driveService = {
			deleteFileSync: jest.fn().mockResolvedValue(undefined),
		} as unknown as { deleteFileSync: jest.MockedFunction<DriveService['deleteFileSync']> };

		emailService = {
			sendEmail: jest.fn().mockResolvedValue(undefined),
		} as unknown as { sendEmail: jest.MockedFunction<EmailService['sendEmail']> };

		searchService = {
			unindexNote: jest.fn().mockResolvedValue(undefined),
		} as unknown as { unindexNote: jest.MockedFunction<SearchService['unindexNote']> };

		const mockLogger = createMockLogger();

		app = await Test.createTestingModule({
			providers: [
				DeleteAccountProcessorService,
				{ provide: DI.config, useValue: { host: 'example.com' } as Config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.userProfilesRepository, useValue: userProfilesRepository },
				{ provide: DI.notesRepository, useValue: notesRepository },
				{ provide: DI.driveFilesRepository, useValue: driveFilesRepository },
				{ provide: DriveService, useValue: driveService },
				{ provide: EmailService, useValue: emailService },
				{ provide: SearchService, useValue: searchService },
				{ provide: QueueLoggerService, useValue: { logger: mockLogger } },
			],
		}).compile();

		service = app.get<DeleteAccountProcessorService>(DeleteAccountProcessorService);
	});

	afterEach(async () => {
		await app.close();
	});

	function createJob(data: DbUserDeleteJobData): Bull.Job<DbUserDeleteJobData> {
		return {
			data,
			progress: jest.fn(),
		} as unknown as Bull.Job<DbUserDeleteJobData>;
	}

	test('does nothing when user not found', async () => {
		usersRepository.findOneBy.mockResolvedValue(null);

		const result = await service.process(createJob({ user: { id: 'user1' } }));

		expect(usersRepository.findOneBy).toHaveBeenCalledWith({ id: 'user1' });
		expect(notesRepository.find).not.toHaveBeenCalled();
		expect(driveFilesRepository.find).not.toHaveBeenCalled();
		expect(usersRepository.delete).not.toHaveBeenCalled();
		expect(result).toBeUndefined();
	});

	test('deletes notes, files, sends email and removes user', async () => {
		const user = new User({ id: 'user1', username: 'alice', host: null });
		const note = new Note({
			id: 'note1',
			userId: user.id,
			visibility: 'public',
		});
		const file = {
			id: 'file1',
			userId: user.id,
		} as DriveFile;
		const profile = {
			userId: user.id,
			email: 'alice@example.com',
			emailVerified: true,
		} as UserProfile;

		usersRepository.findOneBy.mockResolvedValue(user);
		notesRepository.find
			.mockResolvedValueOnce([note])
			.mockResolvedValue([]);
		notesRepository.delete.mockResolvedValue({ raw: [], affected: 1 });
		driveFilesRepository.find
			.mockResolvedValueOnce([file])
			.mockResolvedValue([]);
		userProfilesRepository.findOneByOrFail.mockResolvedValue(profile);

		const result = await service.process(createJob({ user: { id: user.id } }));

		expect(notesRepository.find).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ userId: user.id }),
			take: 100,
			order: { id: 1 },
		}));
		expect(notesRepository.delete).toHaveBeenCalledWith([note.id]);
		expect(searchService.unindexNote).toHaveBeenCalledWith(note);
		expect(driveFilesRepository.find).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ userId: user.id }),
			take: 10,
			order: { id: 1 },
		}));
		expect(driveService.deleteFileSync).toHaveBeenCalledWith(file);
		expect(userProfilesRepository.findOneByOrFail).toHaveBeenCalledWith({ userId: user.id });
		expect(emailService.sendEmail).toHaveBeenCalledWith(
			profile.email,
			'Account deleted',
			expect.any(String),
			expect.any(String),
		);
		expect(usersRepository.delete).toHaveBeenCalledWith(user.id);
		expect(result).toBe('Account deleted');
	});

	test('skips email notification when email is not verified', async () => {
		const user = new User({ id: 'user1', username: 'alice', host: null });
		const profile = {
			userId: user.id,
			email: 'alice@example.com',
			emailVerified: false,
		} as UserProfile;

		usersRepository.findOneBy.mockResolvedValue(user);
		notesRepository.find.mockResolvedValue([]);
		driveFilesRepository.find.mockResolvedValue([]);
		userProfilesRepository.findOneByOrFail.mockResolvedValue(profile);

		await service.process(createJob({ user: { id: user.id } }));

		expect(emailService.sendEmail).not.toHaveBeenCalled();
		expect(usersRepository.delete).toHaveBeenCalledWith(user.id);
	});

	test('skips physical deletion when soft delete is specified', async () => {
		const user = new User({ id: 'user1', username: 'alice', host: null });
		const profile = {
			userId: user.id,
			email: null,
			emailVerified: false,
		} as UserProfile;

		usersRepository.findOneBy.mockResolvedValue(user);
		notesRepository.find.mockResolvedValue([]);
		driveFilesRepository.find.mockResolvedValue([]);
		userProfilesRepository.findOneByOrFail.mockResolvedValue(profile);

		const result = await service.process(createJob({ user: { id: user.id }, soft: true }));

		expect(usersRepository.delete).not.toHaveBeenCalled();
		expect(result).toBe('Account deleted');
	});
});
