process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import type { DataSource } from 'typeorm';
import type { NotesRepository, UsersRepository, FollowingsRepository, PollsRepository, PollVotesRepository, NoteReactionsRepository, DriveFilesRepository } from '@/models/index.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import type { CustomEmojiService } from '@/core/CustomEmojiService.js';
import type { ReactionService } from '@/core/ReactionService.js';
import type { TestingModule } from '@nestjs/testing';

function createNote(data: any = {}): any {
	return {
		id: 'note1',
		createdAt: new Date(Date.now() - 2000),
		userId: 'user1',
		userHost: null,
		text: 'hello',
		cw: null,
		visibility: 'public',
		localOnly: false,
		reactionAcceptance: null,
		visibleUserIds: [],
		renoteCount: 0,
		repliesCount: 0,
		reactions: {},
		emojis: [],
		tags: [],
		fileIds: [],
		mentions: [],
		replyId: null,
		renoteId: null,
		uri: null,
		url: null,
		name: null,
		hasPoll: false,
		...data,
	};
}

function createService() {
	const db = {} as unknown as DataSource;

	const notesRepository = {
		findOneOrFail: jest.fn().mockResolvedValue(createNote({ user: { id: 'user1', isCat: false } })),
		createQueryBuilder: jest.fn().mockReturnValue({
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getCount: jest.fn().mockResolvedValue(0),
		}),
	} as unknown as jest.Mocked<NotesRepository>;

	const usersRepository = {
		findOneByOrFail: jest.fn().mockResolvedValue({ id: 'me1', host: null }),
	} as unknown as jest.Mocked<UsersRepository>;

	const followingsRepository = {
		exist: jest.fn().mockResolvedValue(false),
		count: jest.fn().mockResolvedValue(0),
	} as unknown as jest.Mocked<FollowingsRepository>;

	const pollsRepository = {
		findOneByOrFail: jest.fn().mockResolvedValue({ noteId: 'note1', choices: ['a', 'b'], votes: [1, 2], multiple: false, expiresAt: null }),
	} as unknown as jest.Mocked<PollsRepository>;

	const pollVotesRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
	} as unknown as jest.Mocked<PollVotesRepository>;

	const noteReactionsRepository = {
		findBy: jest.fn().mockResolvedValue([]),
		findOneBy: jest.fn().mockResolvedValue(null),
	} as unknown as jest.Mocked<NoteReactionsRepository>;

	const driveFilesRepository = {} as unknown as jest.Mocked<DriveFilesRepository>;

	const userEntityService = {
		pack: jest.fn().mockResolvedValue({ id: 'user1', isCat: false }),
	} as unknown as jest.Mocked<UserEntityService>;

	const driveFileEntityService = {
		packManyByIds: jest.fn().mockResolvedValue([]),
		packManyByIdsMap: jest.fn().mockResolvedValue(new Map()),
	} as unknown as jest.Mocked<DriveFileEntityService>;

	const customEmojiService = {
		populateEmojis: jest.fn().mockResolvedValue({}),
		prefetchEmojis: jest.fn().mockResolvedValue(undefined),
		parseEmojiStr: jest.fn().mockReturnValue({ name: null, host: null }),
	} as unknown as jest.Mocked<CustomEmojiService>;

	const reactionService = {
		convertLegacyReactions: jest.fn().mockReturnValue({}),
		convertLegacyReaction: jest.fn().mockImplementation(x => x),
		decodeReaction: jest.fn().mockReturnValue({ name: null, host: null }),
	} as unknown as jest.Mocked<ReactionService>;

	const moduleRef = {
		get: jest.fn().mockImplementation(name => {
			if (name === 'UserEntityService') return userEntityService;
			if (name === 'DriveFileEntityService') return driveFileEntityService;
			if (name === 'CustomEmojiService') return customEmojiService;
			if (name === 'ReactionService') return reactionService;
			return undefined;
		}),
	} as any;

	const service = new NoteEntityService(
		moduleRef,
		db,
		usersRepository,
		notesRepository,
		followingsRepository,
		pollsRepository,
		pollVotesRepository,
		noteReactionsRepository,
		driveFilesRepository,
	);

	service.onModuleInit();

	return {
		service,
		mocks: {
			notesRepository,
			usersRepository,
			followingsRepository,
			pollsRepository,
			pollVotesRepository,
			noteReactionsRepository,
			userEntityService,
			driveFileEntityService,
			customEmojiService,
			reactionService,
		},
	};
}

describe('NoteEntityService', () => {
	test('packs note by id', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.findOneOrFail.mockResolvedValue(createNote({ user: { id: 'user1' } }));

		const packed = await service.pack('note1');

		expect(packed.id).toBe('note1');
		expect(packed.text).toBe('hello');
	});

	test('packs note object directly', async () => {
		const { service } = createService();

		const packed = await service.pack(createNote({ user: { id: 'user1' } }));

		expect(packed.id).toBe('note1');
	});

	test('packs article note with name and url', async () => {
		const { service } = createService();

		const packed = await service.pack(createNote({ name: 'Title', url: 'https://example.com/article', text: 'body' }));

		expect(packed.text).toContain('Title');
		expect(packed.text).toContain('https://example.com/article');
	});

	test('nyaizes text for cat user', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.pack.mockResolvedValue({ id: 'user1', isCat: true });

		const packed = await service.pack(createNote({ text: 'なな' }));

		expect(packed.text).toContain('にゃ');
	});

	test('hides specified note when viewer not specified', async () => {
		const { service } = createService();
		const note = createNote({ visibility: 'specified', visibleUserIds: ['other'] });

		const packed = await service.pack(note, { id: 'me1' });

		expect(packed.isHidden).toBe(true);
		expect(packed.text).toBeNull();
	});

	test('shows specified note to author', async () => {
		const { service } = createService();
		const note = createNote({ visibility: 'specified', visibleUserIds: ['other'], userId: 'me1' });

		const packed = await service.pack(note, { id: 'me1' });

		expect(packed.isHidden).toBeUndefined();
	});

	test('hides followers note when not following', async () => {
		const { service, mocks } = createService();
		mocks.followingsRepository.exist.mockResolvedValue(false);
		const note = createNote({ visibility: 'followers' });

		const packed = await service.pack(note, { id: 'me1' });

		expect(packed.isHidden).toBe(true);
	});

	test('shows followers note when following', async () => {
		const { service, mocks } = createService();
		mocks.followingsRepository.exist.mockResolvedValue(true);
		const note = createNote({ visibility: 'followers' });

		const packed = await service.pack(note, { id: 'me1' });

		expect(packed.isHidden).toBeUndefined();
	});

	test('packs poll', async () => {
		const { service } = createService();
		const note = createNote({ hasPoll: true });

		const packed = await service.pack(note, { id: 'me1' });

		expect(packed.poll).toBeDefined();
		expect(packed.poll?.choices).toHaveLength(2);
	});

	test('packs myReaction', async () => {
		const { service, mocks } = createService();
		mocks.noteReactionsRepository.findOneBy.mockResolvedValue({ noteId: 'note1', userId: 'me1', reaction: '❤️' } as any);

		const packed = await service.pack(createNote(), { id: 'me1' });

		expect(packed.myReaction).toBe('❤️');
	});

	test('packMany returns empty for empty notes', async () => {
		const { service } = createService();
		const result = await service.packMany([], { id: 'me1' });
		expect(result).toEqual([]);
	});

	test('isVisibleForMe returns false for specified without me', async () => {
		const { service } = createService();
		const result = await service.isVisibleForMe(createNote({ visibility: 'specified', visibleUserIds: ['other'] }), null);
		expect(result).toBe(false);
	});

	test('isVisibleForMe returns true for public', async () => {
		const { service } = createService();
		const result = await service.isVisibleForMe(createNote(), null);
		expect(result).toBe(true);
	});

	test('isVisibleForMe returns true for followers note when both remote', async () => {
		const { service, mocks } = createService();
		mocks.followingsRepository.count.mockResolvedValue(0);
		mocks.usersRepository.findOneByOrFail.mockResolvedValue({ id: 'me1', host: 'remote.example' } as any);
		const note = createNote({ visibility: 'followers', userHost: 'remote.example', userId: 'user2' });

		const result = await service.isVisibleForMe(note, { id: 'me1' });

		expect(result).toBe(true);
	});

	test('countSameRenotes counts renotes', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.createQueryBuilder.mockReturnValue({
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getCount: jest.fn().mockResolvedValue(3),
		});

		const result = await service.countSameRenotes('user1', 'renote1');

		expect(result).toBe(3);
	});

	test('aggregateNoteEmojis returns remote custom emojis', async () => {
		const { service, mocks } = createService();
		mocks.reactionService.decodeReaction.mockReturnValue({ name: 'cat', host: 'remote.example' } as any);
		mocks.customEmojiService.parseEmojiStr.mockImplementation((e: string) => {
			if (e.startsWith(':')) return { name: 'cat', host: 'remote.example' };
			return { name: null, host: null };
		});

		const result = service.aggregateNoteEmojis([createNote({ reactions: { ':cat@remote.example:': 1 }, emojis: [':cat@remote.example:'] })]);

		expect(result.length).toBeGreaterThan(0);
		expect(result[0]).toMatchObject({ name: 'cat', host: 'remote.example' });
	});
});
