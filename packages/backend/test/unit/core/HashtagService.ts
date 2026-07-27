process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { HashtagService } from '@/core/HashtagService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import type { HashtagsRepository, UsersRepository } from '@/models/index.js';
import type { User } from '@/models/entities/User.js';
import type { Hashtag } from '@/models/entities/Hashtag.js';
import type { TestingModule } from '@nestjs/testing';

function createUser(data: Partial<User> = {}): User {
	return {
		id: 'user1',
		createdAt: new Date(),
		updatedAt: null,
		lastFetchedAt: null,
		lastActiveDate: null,
		hideOnlineStatus: false,
		username: 'alice',
		usernameLower: 'alice',
		name: null,
		followersCount: 0,
		followingCount: 0,
		movedToUri: null,
		movedAt: null,
		alsoKnownAs: null,
		notesCount: 0,
		avatarId: null,
		avatar: null,
		bannerId: null,
		banner: null,
		avatarUrl: null,
		bannerUrl: null,
		avatarBlurhash: null,
		bannerBlurhash: null,
		tags: [],
		isSuspended: false,
		isLocked: false,
		isBot: false,
		isCat: false,
		isRoot: false,
		isExplorable: true,
		isDeleted: false,
		emojis: [],
		host: null,
		inbox: null,
		sharedInbox: null,
		featured: null,
		uri: null,
		followersUri: null,
		token: null,
		...data,
	} as User;
}

function createHashtag(data: Partial<Hashtag> = {}): Hashtag {
	return {
		id: 'hashtag1',
		name: 'tag',
		mentionedUserIds: [],
		mentionedUsersCount: 0,
		mentionedLocalUserIds: [],
		mentionedLocalUsersCount: 0,
		mentionedRemoteUserIds: [],
		mentionedRemoteUsersCount: 0,
		attachedUserIds: [],
		attachedUsersCount: 0,
		attachedLocalUserIds: [],
		attachedLocalUsersCount: 0,
		attachedRemoteUserIds: [],
		attachedRemoteUsersCount: 0,
		...data,
	} as Hashtag;
}

describe('HashtagService', () => {
	let app: TestingModule;
	let hashtagService: HashtagService;
	let hashtagsRepository: jest.Mocked<HashtagsRepository>;
	let usersRepository: jest.Mocked<UsersRepository>;
	let idService: jest.Mocked<IdService>;
	let userEntityService: jest.Mocked<UserEntityService>;

	beforeEach(async () => {
		const queryBuilder = {
			update: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue(undefined),
		};

		hashtagsRepository = {
			findOneBy: jest.fn(),
			insert: jest.fn().mockResolvedValue(undefined),
			createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
		} as unknown as jest.Mocked<HashtagsRepository>;

		usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		idService = {
			genId: jest.fn().mockReturnValue('newid'),
		} as unknown as jest.Mocked<IdService>;

		userEntityService = {
			isLocalUser: jest.fn((user) => user.host == null),
			isRemoteUser: jest.fn((user) => user.host != null),
		} as unknown as jest.Mocked<UserEntityService>;

		app = await Test.createTestingModule({
			providers: [
				HashtagService,
				{ provide: DI.hashtagsRepository, useValue: hashtagsRepository },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: UserEntityService, useValue: userEntityService },
				{ provide: IdService, useValue: idService },
			],
		}).compile();

		hashtagService = app.get<HashtagService>(HashtagService);
	});

	afterEach(async () => {
		await app.close();
	});

	describe('updateHashtags', () => {
		test('updates each hashtag', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(null);
			const user = createUser();

			await hashtagService.updateHashtags(user, ['foo', 'bar']);

			expect(hashtagsRepository.findOneBy).toHaveBeenCalledTimes(2);
			expect(hashtagsRepository.insert).toHaveBeenCalledTimes(2);
		});
	});

	describe('updateUsertags', () => {
		test('attaches new tags and detaches removed tags', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(createHashtag({ attachedUserIds: ['otheruser'] }));
			const user = createUser({ tags: ['old'] });

			await hashtagService.updateUsertags(user, ['new']);

			expect(hashtagsRepository.findOneBy).toHaveBeenCalledWith({ name: 'new' });
			expect(hashtagsRepository.findOneBy).toHaveBeenCalledWith({ name: 'old' });
		});
	});

	describe('updateHashtag', () => {
		test('does nothing when index is missing and increment is false', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(null);

			await hashtagService.updateHashtag(createUser(), 'tag', true, false);

			expect(hashtagsRepository.findOneBy).toHaveBeenCalledWith({ name: 'tag' });
			expect(hashtagsRepository.createQueryBuilder).not.toHaveBeenCalled();
			expect(hashtagsRepository.insert).not.toHaveBeenCalled();
		});

		test('inserts new attached hashtag for local user', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(null);

			await hashtagService.updateHashtag(createUser({ host: null }), 'Tag', true, true);

			expect(hashtagsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
				id: 'newid',
				name: 'tag',
				attachedUserIds: ['user1'],
				attachedUsersCount: 1,
				attachedLocalUserIds: ['user1'],
				attachedLocalUsersCount: 1,
				attachedRemoteUserIds: [],
				attachedRemoteUsersCount: 0,
				mentionedUserIds: [],
				mentionedUsersCount: 0,
				mentionedLocalUserIds: [],
				mentionedLocalUsersCount: 0,
				mentionedRemoteUserIds: [],
				mentionedRemoteUsersCount: 0,
			}));
		});

		test('inserts new attached hashtag for remote user', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(null);

			await hashtagService.updateHashtag(createUser({ host: 'example.com' }), 'Tag', true, true);

			expect(hashtagsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
				attachedRemoteUserIds: ['user1'],
				attachedRemoteUsersCount: 1,
				attachedLocalUserIds: [],
				attachedLocalUsersCount: 0,
			}));
		});

		test('inserts new mentioned hashtag', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(null);

			await hashtagService.updateHashtag(createUser(), 'Tag');

			expect(hashtagsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
				mentionedUserIds: ['user1'],
				mentionedUsersCount: 1,
				attachedUserIds: [],
				attachedUsersCount: 0,
			}));
		});

		test('skips update when user already attached', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(createHashtag({
				attachedUserIds: ['user1'],
				attachedLocalUserIds: ['user1'],
				attachedRemoteUserIds: [],
			}));

			await hashtagService.updateHashtag(createUser(), 'tag', true, true);

			const qb = hashtagsRepository.createQueryBuilder.mock.results[0].value;
			expect(qb.set).not.toHaveBeenCalled();
			expect(qb.execute).not.toHaveBeenCalled();
			expect(hashtagsRepository.insert).not.toHaveBeenCalled();
		});

		test('appends attached user arrays on increment', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(createHashtag({ attachedUserIds: ['other'] }));

			await hashtagService.updateHashtag(createUser(), 'tag', true, true);

			const qb = hashtagsRepository.createQueryBuilder.mock.results[0].value;
			expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({
				attachedUserIds: expect.any(Function),
				attachedUsersCount: expect.any(Function),
				attachedLocalUserIds: expect.any(Function),
				attachedLocalUsersCount: expect.any(Function),
			}));
			expect(qb.execute).toHaveBeenCalled();
		});

		test('removes user arrays on decrement', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(createHashtag({ attachedUserIds: ['user1'] }));

			await hashtagService.updateHashtag(createUser(), 'tag', true, false);

			const qb = hashtagsRepository.createQueryBuilder.mock.results[0].value;
			expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({
				attachedUserIds: expect.any(Function),
				attachedUsersCount: expect.any(Function),
				attachedLocalUserIds: expect.any(Function),
				attachedLocalUsersCount: expect.any(Function),
			}));
			expect(qb.execute).toHaveBeenCalled();
		});

		test('appends mentioned user arrays on increment', async () => {
			hashtagsRepository.findOneBy.mockResolvedValue(createHashtag({ mentionedUserIds: ['other'] }));

			await hashtagService.updateHashtag(createUser(), 'tag');

			const qb = hashtagsRepository.createQueryBuilder.mock.results[0].value;
			expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({
				mentionedUserIds: expect.any(Function),
				mentionedUsersCount: expect.any(Function),
			}));
		});
	});
});
