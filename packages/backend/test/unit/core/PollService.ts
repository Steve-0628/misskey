process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PollService } from '@/core/PollService.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import type { NotesRepository, PollsRepository, PollVotesRepository, UsersRepository } from '@/models/index.js';
import type { User } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';
import type { Poll } from '@/models/entities/Poll.js';
import type { TestingModule } from '@nestjs/testing';

function createUser(data: Partial<User> = {}): User {
	return {
		id: 'user1',
		createdAt: new Date(),
		username: 'alice',
		usernameLower: 'alice',
		host: null,
		...data,
	} as User;
}

function createNote(data: Partial<Note> = {}): Note {
	return {
		id: 'note1',
		createdAt: new Date(),
		userId: 'user1',
		userHost: null,
		text: 'poll note',
		cw: null,
		visibility: 'public',
		...data,
	} as Note;
}

function createPoll(data: Partial<Poll> = {}): Poll {
	return {
		noteId: 'note1',
		choices: ['a', 'b'],
		votes: [0, 0],
		multiple: false,
		expiresAt: null,
		noteVisibility: 'public',
		userId: 'user1',
		userHost: null,
		...data,
	} as Poll;
}

describe('PollService', () => {
	let app: TestingModule;
	let pollService: PollService;
	let pollsRepository: jest.Mocked<PollsRepository>;
	let pollVotesRepository: jest.Mocked<PollVotesRepository>;
	let notesRepository: jest.Mocked<NotesRepository>;
	let usersRepository: jest.Mocked<UsersRepository>;
	let userBlockingService: jest.Mocked<UserBlockingService>;
	let globalEventService: jest.Mocked<GlobalEventService>;
	let idService: jest.Mocked<IdService>;

	beforeEach(async () => {
		pollsRepository = {
			findOneBy: jest.fn(),
			query: jest.fn(),
		} as unknown as jest.Mocked<PollsRepository>;

		pollVotesRepository = {
			findBy: jest.fn(),
			insert: jest.fn(),
		} as unknown as jest.Mocked<PollVotesRepository>;

		notesRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<NotesRepository>;

		usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		userBlockingService = {
			checkBlocked: jest.fn(),
		} as unknown as jest.Mocked<UserBlockingService>;

		globalEventService = {
			publishNoteStream: jest.fn(),
		} as unknown as jest.Mocked<GlobalEventService>;

		idService = {
			genId: jest.fn(),
		} as unknown as jest.Mocked<IdService>;

		const userEntityService = {
			isLocalUser: jest.fn().mockReturnValue(true),
			isRemoteUser: jest.fn().mockReturnValue(false),
		} as unknown as jest.Mocked<UserEntityService>;

		const apRendererService = {
			addContext: jest.fn((x) => x),
			renderUpdate: jest.fn(),
			renderNote: jest.fn(),
		} as unknown as jest.Mocked<ApRendererService>;

		const apDeliverManagerService = {
			deliverToFollowers: jest.fn(),
		} as unknown as jest.Mocked<ApDeliverManagerService>;

		app = await Test.createTestingModule({
			providers: [
				PollService,
				{ provide: DI.pollsRepository, useValue: pollsRepository },
				{ provide: DI.pollVotesRepository, useValue: pollVotesRepository },
				{ provide: DI.notesRepository, useValue: notesRepository },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: UserBlockingService, useValue: userBlockingService },
				{ provide: GlobalEventService, useValue: globalEventService },
				{ provide: IdService, useValue: idService },
				{ provide: UserEntityService, useValue: userEntityService },
				{ provide: ApRendererService, useValue: apRendererService },
				{ provide: ApDeliverManagerService, useValue: apDeliverManagerService },
			],
		}).compile();

		pollService = app.get<PollService>(PollService);
	});

	afterEach(async () => {
		await app.close();
	});

	describe('vote', () => {
		test('throws when poll is not found', async () => {
			pollsRepository.findOneBy.mockResolvedValue(null);

			await expect(pollService.vote(createUser(), createNote(), 0)).rejects.toThrow('poll not found');
		});

		test('throws when choice is invalid', async () => {
			pollsRepository.findOneBy.mockResolvedValue(createPoll());

			await expect(pollService.vote(createUser(), createNote(), 5)).rejects.toThrow('invalid choice param');
		});

		test('throws when blocked by note author', async () => {
			const note = createNote({ userId: 'author1' });
			pollsRepository.findOneBy.mockResolvedValue(createPoll());
			userBlockingService.checkBlocked.mockResolvedValue(true);

			await expect(pollService.vote(createUser({ id: 'user2' }), note, 0)).rejects.toThrow('blocked');
		});

		test('skips block check when voting on own note', async () => {
			const user = createUser({ id: 'user1' });
			const note = createNote({ userId: 'user1' });
			pollsRepository.findOneBy.mockResolvedValue(createPoll());
			pollVotesRepository.findBy.mockResolvedValue([]);
			pollVotesRepository.insert.mockResolvedValue(undefined);
			pollsRepository.query.mockResolvedValue(undefined);
			idService.genId.mockReturnValue('vote1');

			await pollService.vote(user, note, 0);

			expect(userBlockingService.checkBlocked).not.toHaveBeenCalled();
		});

		test('throws when already voted on single-choice poll', async () => {
			const note = createNote({ userId: 'author1' });
			pollsRepository.findOneBy.mockResolvedValue(createPoll({ multiple: false }));
			userBlockingService.checkBlocked.mockResolvedValue(false);
			pollVotesRepository.findBy.mockResolvedValue([{ choice: 0 } as any]);

			await expect(pollService.vote(createUser({ id: 'user2' }), note, 1)).rejects.toThrow('already voted');
		});

		test('throws when same choice already voted on multiple-choice poll', async () => {
			const note = createNote({ userId: 'author1' });
			pollsRepository.findOneBy.mockResolvedValue(createPoll({ multiple: true }));
			userBlockingService.checkBlocked.mockResolvedValue(false);
			pollVotesRepository.findBy.mockResolvedValue([{ choice: 0 } as any]);

			await expect(pollService.vote(createUser({ id: 'user2' }), note, 0)).rejects.toThrow('already voted');
		});

		test('successfully votes and increments count', async () => {
			const user = createUser({ id: 'user2' });
			const note = createNote({ userId: 'author1', id: 'note1' });
			pollsRepository.findOneBy.mockResolvedValue(createPoll({ noteId: 'note1', choices: ['a', 'b'], votes: [0, 0] }));
			userBlockingService.checkBlocked.mockResolvedValue(false);
			pollVotesRepository.findBy.mockResolvedValue([]);
			pollVotesRepository.insert.mockResolvedValue(undefined);
			pollsRepository.query.mockResolvedValue(undefined);
			idService.genId.mockReturnValue('vote1');

			await pollService.vote(user, note, 1);

			expect(pollVotesRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
				noteId: 'note1',
				userId: 'user2',
				choice: 1,
			}));
			expect(pollsRepository.query).toHaveBeenCalledWith('UPDATE poll SET votes[2] = votes[2] + 1 WHERE "noteId" = \'note1\'');
			expect(globalEventService.publishNoteStream).toHaveBeenCalledWith('note1', 'pollVoted', {
				choice: 1,
				userId: 'user2',
			});
		});

		test('successfully votes multiple choices on multiple-choice poll', async () => {
			const user = createUser({ id: 'user2' });
			const note = createNote({ userId: 'author1', id: 'note1' });
			pollsRepository.findOneBy.mockResolvedValue(createPoll({ noteId: 'note1', multiple: true }));
			userBlockingService.checkBlocked.mockResolvedValue(false);
			pollVotesRepository.findBy.mockResolvedValue([{ choice: 0 } as any]);
			pollVotesRepository.insert.mockResolvedValue(undefined);
			pollsRepository.query.mockResolvedValue(undefined);
			idService.genId.mockReturnValue('vote2');

			await pollService.vote(user, note, 1);

			expect(pollVotesRepository.insert).toHaveBeenCalled();
		});
	});

	describe('deliverQuestionUpdate', () => {
		test('throws when note is not found', async () => {
			notesRepository.findOneBy.mockResolvedValue(null);

			await expect(pollService.deliverQuestionUpdate('note1')).rejects.toThrow('note not found');
		});

		test('throws when user is not found', async () => {
			notesRepository.findOneBy.mockResolvedValue(createNote());
			usersRepository.findOneBy.mockResolvedValue(null);

			await expect(pollService.deliverQuestionUpdate('note1')).rejects.toThrow('note not found');
		});

		test('delivers update for local user', async () => {
			const note = createNote();
			const user = createUser();
			notesRepository.findOneBy.mockResolvedValue(note);
			usersRepository.findOneBy.mockResolvedValue(user);

			const apDeliverManagerService = app.get<jest.Mocked<ApDeliverManagerService>>(ApDeliverManagerService);
			const apRendererService = app.get<jest.Mocked<ApRendererService>>(ApRendererService);

			await pollService.deliverQuestionUpdate('note1');

			expect(apRendererService.renderNote).toHaveBeenCalledWith(note, false);
			expect(apDeliverManagerService.deliverToFollowers).toHaveBeenCalled();
		});

		test('does nothing for remote user', async () => {
			const note = createNote();
			const user = createUser({ host: 'example.com' });
			notesRepository.findOneBy.mockResolvedValue(note);
			usersRepository.findOneBy.mockResolvedValue(user);

			const userEntityService = app.get<jest.Mocked<UserEntityService>>(UserEntityService);
			userEntityService.isLocalUser.mockReturnValue(false);
			userEntityService.isRemoteUser.mockReturnValue(true);

			const apDeliverManagerService = app.get<jest.Mocked<ApDeliverManagerService>>(ApDeliverManagerService);

			await pollService.deliverQuestionUpdate('note1');

			expect(apDeliverManagerService.deliverToFollowers).not.toHaveBeenCalled();
		});
	});
});
