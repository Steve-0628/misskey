process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type Redis from 'ioredis';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import type { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import type { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import type { RoleService } from '@/core/RoleService.js';
import type { AntennaService } from '@/core/AntennaService.js';
import type { CustomEmojiService } from '@/core/CustomEmojiService.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import type { User } from '@/models/entities/User.js';
import type { UserProfile } from '@/models/entities/UserProfile.js';
import type {
	UsersRepository,
	UserSecurityKeysRepository,
	FollowingsRepository,
	FollowRequestsRepository,
	BlockingsRepository,
	MutingsRepository,
	RenoteMutingsRepository,
	DriveFilesRepository,
	NoteUnreadsRepository,
	UserNotePiningsRepository,
	UserProfilesRepository,
	InstancesRepository,
	UserMemoRepository,
} from '@/models/index.js';
import type { Packed } from '@/misc/json-schema.js';
import type { TestingModule } from '@nestjs/testing';

function createUser(data: Partial<User> = {}): User {
	return {
		id: 'user1',
		createdAt: new Date('2023-01-01T00:00:00.000Z'),
		updatedAt: new Date('2023-01-01T00:00:00.000Z'),
		lastFetchedAt: null,
		lastActiveDate: new Date('2023-01-01T00:00:00.000Z'),
		hideOnlineStatus: false,
		username: 'alice',
		usernameLower: 'alice',
		name: 'Alice',
		followersCount: 5,
		followingCount: 10,
		movedToUri: null,
		movedAt: null,
		alsoKnownAs: null,
		notesCount: 20,
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
	} as unknown as User;
}

function createUserProfile(data: Partial<UserProfile> = {}): UserProfile {
	return {
		userId: 'user1',
		user: null,
		location: null,
		birthday: null,
		description: null,
		fields: [],
		lang: null,
		url: null,
		email: null,
		emailVerifyCode: null,
		emailVerified: false,
		emailNotificationTypes: [],
		publicReactions: true,
		ffVisibility: 'public',
		twoFactorTempSecret: null,
		twoFactorSecret: null,
		twoFactorEnabled: false,
		securityKeysAvailable: false,
		usePasswordLessLogin: false,
		password: null,
		moderationNote: null,
		clientData: {},
		room: {},
		autoAcceptFollowed: false,
		noCrawle: false,
		preventAiLearning: true,
		alwaysMarkNsfw: false,
		carefulBot: false,
		injectFeaturedNote: true,
		enableWordMute: false,
		mutedWords: [],
		mutedInstances: [],
		mutingNotificationTypes: [],
		loggedInDates: [],
		achievements: [],
		userHost: null,
		...data,
	} as unknown as UserProfile;
}

function createQueryBuilderMock<T>(result: T) {
	return jest.fn().mockReturnValue({
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		innerJoinAndSelect: jest.fn().mockReturnThis(),
		orderBy: jest.fn().mockReturnThis(),
		getMany: jest.fn().mockResolvedValue(result),
	});
}

describe('UserEntityService', () => {
	let app: TestingModule;
	let service: UserEntityService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let userSecurityKeysRepository: jest.Mocked<UserSecurityKeysRepository>;
	let followingsRepository: jest.Mocked<FollowingsRepository>;
	let followRequestsRepository: jest.Mocked<FollowRequestsRepository>;
	let blockingsRepository: jest.Mocked<BlockingsRepository>;
	let mutingsRepository: jest.Mocked<MutingsRepository>;
	let renoteMutingsRepository: jest.Mocked<RenoteMutingsRepository>;
	let driveFilesRepository: jest.Mocked<DriveFilesRepository>;
	let noteUnreadsRepository: jest.Mocked<NoteUnreadsRepository>;
	let userNotePiningsRepository: jest.Mocked<UserNotePiningsRepository>;
	let userProfilesRepository: jest.Mocked<UserProfilesRepository>;
	let userMemosRepository: jest.Mocked<UserMemoRepository>;
	let redisClient: jest.Mocked<Redis.Redis>;
	let roleService: jest.Mocked<RoleService>;
	let customEmojiService: jest.Mocked<CustomEmojiService>;
	let noteEntityService: jest.Mocked<NoteEntityService>;
	let driveFileEntityService: jest.Mocked<DriveFileEntityService>;
	let apPersonService: jest.Mocked<ApPersonService>;
	let federatedInstanceService: jest.Mocked<FederatedInstanceService>;
	let antennaService: jest.Mocked<AntennaService>;

	beforeEach(async () => {
		usersRepository = {
			findOneByOrFail: jest.fn(),
			update: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		userSecurityKeysRepository = {
			countBy: jest.fn().mockResolvedValue(0),
			find: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<UserSecurityKeysRepository>;

		followingsRepository = {
			count: jest.fn().mockResolvedValue(0),
		} as unknown as jest.Mocked<FollowingsRepository>;

		followRequestsRepository = {
			count: jest.fn().mockResolvedValue(0),
			countBy: jest.fn().mockResolvedValue(0),
		} as unknown as jest.Mocked<FollowRequestsRepository>;

		blockingsRepository = {
			count: jest.fn().mockResolvedValue(0),
		} as unknown as jest.Mocked<BlockingsRepository>;

		mutingsRepository = {
			count: jest.fn().mockResolvedValue(0),
		} as unknown as jest.Mocked<MutingsRepository>;

		renoteMutingsRepository = {
			count: jest.fn().mockResolvedValue(0),
		} as unknown as jest.Mocked<RenoteMutingsRepository>;

		driveFilesRepository = {
			findOneByOrFail: jest.fn(),
		} as unknown as jest.Mocked<DriveFilesRepository>;

		noteUnreadsRepository = {
			count: jest.fn().mockResolvedValue(0),
		} as unknown as jest.Mocked<NoteUnreadsRepository>;

		userNotePiningsRepository = {
			createQueryBuilder: createQueryBuilderMock([]),
		} as unknown as jest.Mocked<UserNotePiningsRepository>;

		userProfilesRepository = {
			findOneByOrFail: jest.fn(),
		} as unknown as jest.Mocked<UserProfilesRepository>;

		const instancesRepository = {} as unknown as jest.Mocked<InstancesRepository>;

		userMemosRepository = {
			findOneBy: jest.fn().mockResolvedValue(null),
		} as unknown as jest.Mocked<UserMemoRepository>;

		redisClient = {
			get: jest.fn().mockResolvedValue(null),
			xrevrange: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<Redis.Redis>;

		roleService = {
			isModerator: jest.fn().mockResolvedValue(false),
			isAdministrator: jest.fn().mockResolvedValue(false),
			getUserBadgeRoles: jest.fn().mockResolvedValue([]),
			getUserPolicies: jest.fn().mockResolvedValue({ canPublicNote: true }),
			getUserRoles: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<RoleService>;

		customEmojiService = {
			populateEmojis: jest.fn().mockResolvedValue({}),
			prefetchEmojis: jest.fn().mockResolvedValue(undefined),
			parseEmojiStr: jest.fn().mockReturnValue({ name: null, host: null }),
		} as unknown as jest.Mocked<CustomEmojiService>;

		noteEntityService = {
			packMany: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<NoteEntityService>;

		driveFileEntityService = {
			getPublicUrl: jest.fn().mockReturnValue('https://example.com/files/avatar.png'),
		} as unknown as jest.Mocked<DriveFileEntityService>;

		apPersonService = {
			resolvePerson: jest.fn().mockResolvedValue({ id: 'moved1' }),
			fetchPerson: jest.fn().mockResolvedValue({ id: 'aka1' }),
		} as unknown as jest.Mocked<ApPersonService>;

		federatedInstanceService = {
			federatedInstanceCache: {
				fetch: jest.fn().mockResolvedValue({
					name: 'Remote Instance',
					softwareName: 'mastodon',
					softwareVersion: '4.0',
					iconUrl: null,
					faviconUrl: null,
					themeColor: null,
				}),
			},
		} as unknown as jest.Mocked<FederatedInstanceService>;

		antennaService = {
			getAntennas: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<AntennaService>;

		const config = {
			url: 'https://example.com',
			host: 'example.com',
		};

		app = await Test.createTestingModule({
			providers: [
				UserEntityService,
				{ provide: DI.config, useValue: config },
				{ provide: DI.redis, useValue: redisClient },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.userSecurityKeysRepository, useValue: userSecurityKeysRepository },
				{ provide: DI.followingsRepository, useValue: followingsRepository },
				{ provide: DI.followRequestsRepository, useValue: followRequestsRepository },
				{ provide: DI.blockingsRepository, useValue: blockingsRepository },
				{ provide: DI.mutingsRepository, useValue: mutingsRepository },
				{ provide: DI.renoteMutingsRepository, useValue: renoteMutingsRepository },
				{ provide: DI.driveFilesRepository, useValue: driveFilesRepository },
				{ provide: DI.noteUnreadsRepository, useValue: noteUnreadsRepository },
				{ provide: DI.userNotePiningsRepository, useValue: userNotePiningsRepository },
				{ provide: DI.userProfilesRepository, useValue: userProfilesRepository },
				{ provide: DI.instancesRepository, useValue: instancesRepository },
				{ provide: DI.userMemosRepository, useValue: userMemosRepository },
				{ provide: 'RoleService', useValue: roleService },
				{ provide: 'CustomEmojiService', useValue: customEmojiService },
				{ provide: 'NoteEntityService', useValue: noteEntityService },
				{ provide: 'DriveFileEntityService', useValue: driveFileEntityService },
				{ provide: 'ApPersonService', useValue: apPersonService },
				{ provide: 'FederatedInstanceService', useValue: federatedInstanceService },
				{ provide: 'AntennaService', useValue: antennaService },
			],
		}).compile();

		service = app.get<UserEntityService>(UserEntityService);
		service.onModuleInit();
	});

	afterEach(async () => {
		await app.close();
	});

	describe('validators', () => {
		test('validateLocalUsername accepts valid name', () => {
			expect(service.validateLocalUsername('alice')).toBe(true);
		});

		test('validateLocalUsername rejects empty name', () => {
			expect(service.validateLocalUsername('')).toBe(false);
		});

		test('validatePassword accepts non-empty password', () => {
			expect(service.validatePassword('password')).toBe(true);
		});

		test('validatePassword rejects empty password', () => {
			expect(service.validatePassword('')).toBe(false);
		});

		test('validateName accepts valid name', () => {
			expect(service.validateName('Alice')).toBe(true);
		});

		test('validateDescription accepts valid description', () => {
			expect(service.validateDescription('hello')).toBe(true);
		});

		test('validateLocation accepts valid location', () => {
			expect(service.validateLocation('Japan')).toBe(true);
		});

		test('validateBirthday accepts valid birthday', () => {
			expect(service.validateBirthday('2000-01-01')).toBe(true);
		});

		test('validateBirthday rejects invalid birthday', () => {
			expect(service.validateBirthday('01-01-2000')).toBe(false);
		});
	});

	describe('isLocalUser / isRemoteUser', () => {
		test('local user has null host', () => {
			const user = createUser({ host: null });
			expect(service.isLocalUser(user)).toBe(true);
			expect(service.isRemoteUser(user)).toBe(false);
		});

		test('remote user has host', () => {
			const user = createUser({ host: 'remote.example' });
			expect(service.isLocalUser(user)).toBe(false);
			expect(service.isRemoteUser(user)).toBe(true);
		});
	});

	describe('getRelation', () => {
		test('returns relation with all flags false by default', async () => {
			const relation = await service.getRelation('me', 'target');
			expect(relation.id).toBe('target');
			expect(relation.isFollowing).toBe(false);
			expect(relation.isFollowed).toBe(false);
			expect(relation.hasPendingFollowRequestFromYou).toBe(false);
			expect(relation.hasPendingFollowRequestToYou).toBe(false);
			expect(relation.isBlocking).toBe(false);
			expect(relation.isBlocked).toBe(false);
			expect(relation.isMuted).toBe(false);
			expect(relation.isRenoteMuted).toBe(false);
		});

		test('returns true when following exists', async () => {
			followingsRepository.count.mockResolvedValueOnce(1);
			const relation = await service.getRelation('me', 'target');
			expect(relation.isFollowing).toBe(true);
		});
	});

	describe('getHasUnreadNotification', () => {
		test('returns false when no notifications', async () => {
			redisClient.xrevrange.mockResolvedValue([]);
			const result = await service.getHasUnreadNotification('user1');
			expect(result).toBe(false);
		});

		test('returns true when latest notification is newer than read position', async () => {
			redisClient.get.mockResolvedValue('1');
			redisClient.xrevrange.mockResolvedValue([['2', ['key', 'value']]]);
			const result = await service.getHasUnreadNotification('user1');
			expect(result).toBe(true);
		});

		test('returns true when no read position but notification exists', async () => {
			redisClient.get.mockResolvedValue(null);
			redisClient.xrevrange.mockResolvedValue([['1', ['key', 'value']]]);
			const result = await service.getHasUnreadNotification('user1');
			expect(result).toBe(true);
		});
	});

	describe('getHasPendingReceivedFollowRequest', () => {
		test('returns true when count > 0', async () => {
			followRequestsRepository.countBy.mockResolvedValue(3);
			const result = await service.getHasPendingReceivedFollowRequest('user1');
			expect(result).toBe(true);
		});
	});

	describe('getOnlineStatus', () => {
		test('returns unknown when online status hidden', () => {
			const user = createUser({ hideOnlineStatus: true, lastActiveDate: new Date() });
			expect(service.getOnlineStatus(user)).toBe('unknown');
		});

		test('returns unknown when lastActiveDate is null', () => {
			const user = createUser({ lastActiveDate: null });
			expect(service.getOnlineStatus(user)).toBe('unknown');
		});

		test('returns online for recent activity', () => {
			const user = createUser({ lastActiveDate: new Date() });
			expect(service.getOnlineStatus(user)).toBe('online');
		});

		test('returns offline for old activity', () => {
			const user = createUser({ lastActiveDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4) });
			expect(service.getOnlineStatus(user)).toBe('offline');
		});
	});

	describe('getIdenticonUrl', () => {
		test('returns local identicon url', () => {
			const user = createUser({ username: 'Alice', host: null });
			expect(service.getIdenticonUrl(user)).toBe('https://example.com/identicon/alice@example.com');
		});

		test('returns remote identicon url', () => {
			const user = createUser({ username: 'Bob', host: 'remote.example' });
			expect(service.getIdenticonUrl(user)).toBe('https://example.com/identicon/bob@remote.example');
		});
	});

	describe('getUserUri / genLocalUserUri', () => {
		test('genLocalUserUri generates local uri', () => {
			expect(service.genLocalUserUri('user1')).toBe('https://example.com/users/user1');
		});

		test('getUserUri returns remote uri for remote user', () => {
			const user = createUser({ host: 'remote.example', uri: 'https://remote.example/users/bob' }) as User;
			expect(service.getUserUri(user)).toBe('https://remote.example/users/bob');
		});

		test('getUserUri generates local uri for local user', () => {
			const user = createUser({ host: null, uri: null });
			expect(service.getUserUri(user)).toBe('https://example.com/users/user1');
		});
	});

	describe('pack', () => {
		test('packs user by id', async () => {
			const user = createUser();
			usersRepository.findOneByOrFail.mockResolvedValue(user);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack('user1');

			expect(usersRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'user1' });
			expect(packed.id).toBe('user1');
			expect(packed.username).toBe('alice');
		});

		test('packs user object directly', async () => {
			const user = createUser();
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack(user, null, { detail: true });

			expect(packed.id).toBe('user1');
		});

		test('packs lite user when detail is false', async () => {
			const user = createUser();
			userProfilesRepository.findOneByOrFail.mockRejectedValue(new Error('should not be called'));

			const packed = await service.pack(user);

			expect((packed as Packed<'UserDetailed'>).description).toBeUndefined();
		});

		test('packs detailed user when detail is true', async () => {
			const user = createUser();
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile({ description: 'hello' }));

			const packed = await service.pack(user, null, { detail: true });

			expect((packed as Packed<'UserDetailed'>).description).toBe('hello');
		});

		test('packs MeDetailed when me is the same user', async () => {
			const user = createUser();
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack(user, { id: 'user1' }, { detail: true });

			expect((packed as Packed<'MeDetailed'>).avatarId).toBeNull();
			expect((packed as Packed<'MeDetailed'>).hasUnreadChannel).toBe(false);
		});

		test('includes secrets when includeSecrets is true', async () => {
			const user = createUser();
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile({ email: 'alice@example.com' }));

			const packed = await service.pack(user, { id: 'user1' }, { detail: true, includeSecrets: true });

			expect((packed as Packed<'MeDetailed'>).email).toBe('alice@example.com');
		});

		test('migrates avatar when avatarId exists but avatarUrl is null', async () => {
			const user = createUser({ avatarId: 'avatar1', avatarUrl: null });
			const avatar = {
				id: 'avatar1',
				blurhash: 'blur',
			} as unknown as Parameters<DriveFileEntityService['getPublicUrl']>[0];
			driveFilesRepository.findOneByOrFail.mockResolvedValue(avatar as never);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			await service.pack(user, null, { detail: true });

			expect(driveFilesRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'avatar1' });
			expect(usersRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({ avatarUrl: 'https://example.com/files/avatar.png' }));
		});

		test('migrates banner when bannerId exists but bannerUrl is null', async () => {
			const user = createUser({ bannerId: 'banner1', bannerUrl: null });
			const banner = {
				id: 'banner1',
				blurhash: 'blur',
			} as unknown as Parameters<DriveFileEntityService['getPublicUrl']>[0];
			driveFilesRepository.findOneByOrFail.mockResolvedValue(banner as never);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			await service.pack(user, null, { detail: true });

			expect(driveFilesRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'banner1' });
			expect(usersRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({ bannerUrl: 'https://example.com/files/avatar.png' }));
		});

		test('local user has badgeRoles and no instance', async () => {
			const user = createUser({ host: null });
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack(user, null, { detail: true });

			expect((packed as Packed<'UserDetailed'>).instance).toBeUndefined();
			expect(roleService.getUserBadgeRoles).toHaveBeenCalledWith('user1');
		});

		test('remote user has instance and no badgeRoles', async () => {
			const user = createUser({ host: 'remote.example' });
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack(user, null, { detail: true });

			expect((packed as Packed<'UserDetailed'>).instance).toEqual(expect.objectContaining({ name: 'Remote Instance' }));
			expect(roleService.getUserBadgeRoles).not.toHaveBeenCalled();
		});

		test('relation is included when me is not target and detail is true', async () => {
			const user = createUser({ id: 'target' });
			followingsRepository.count.mockResolvedValueOnce(1);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack(user, { id: 'me' }, { detail: true });

			expect((packed as Packed<'UserDetailed'>).isFollowing).toBe(true);
		});

		test('hides follower counts when ffVisibility is private and not following', async () => {
			const user = createUser({ id: 'target', followersCount: 100, followingCount: 200 });
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile({ ffVisibility: 'private' }));

			const packed = await service.pack(user, { id: 'me' }, { detail: true });

			expect((packed as Packed<'UserDetailed'>).followersCount).toBe(0);
			expect((packed as Packed<'UserDetailed'>).followingCount).toBe(0);
		});

		test('shows follower counts when ffVisibility is followers and viewer is following', async () => {
			const user = createUser({ id: 'target', followersCount: 100, followingCount: 200 });
			followingsRepository.count.mockResolvedValueOnce(1);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile({ ffVisibility: 'followers' }));

			const packed = await service.pack(user, { id: 'me' }, { detail: true });

			expect((packed as Packed<'UserDetailed'>).followersCount).toBe(100);
			expect((packed as Packed<'UserDetailed'>).followingCount).toBe(200);
		});

		test('resolves movedTo and alsoKnownAs for remote user', async () => {
			const user = createUser({ host: 'remote.example', movedToUri: 'https://new.example/user', alsoKnownAs: ['https://old.example/user'] });
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack(user, null, { detail: true });

			expect((packed as Packed<'UserDetailed'>).movedTo).toBe('moved1');
			expect((packed as Packed<'UserDetailed'>).alsoKnownAs).toEqual(['aka1']);
		});

		test('does not include secrets by default', async () => {
			const user = createUser();
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile({ email: 'alice@example.com' }));

			const packed = await service.pack(user, { id: 'user1' }, { detail: true });

			expect((packed as Packed<'MeDetailed'>).email).toBeUndefined();
		});

		test('omits relation when detail is false', async () => {
			const user = createUser({ id: 'target' });
			followingsRepository.count.mockResolvedValueOnce(1);

			const packed = await service.pack(user, { id: 'me' }, { detail: false });

			expect((packed as Packed<'UserLite'>).isFollowing).toBeUndefined();
		});

		test('omits relation when me equals target', async () => {
			const user = createUser({ id: 'me' });
			followingsRepository.count.mockResolvedValueOnce(1);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack(user, { id: 'me' }, { detail: true });

			expect((packed as Packed<'MeDetailed'>).isFollowing).toBeUndefined();
		});

		test('hides follower counts when ffVisibility is private even when following', async () => {
			const user = createUser({ id: 'target', followersCount: 100, followingCount: 200 });
			followingsRepository.count.mockResolvedValueOnce(1);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile({ ffVisibility: 'private' }));

			const packed = await service.pack(user, { id: 'me' }, { detail: true });

			expect((packed as Packed<'UserDetailed'>).followersCount).toBe(0);
			expect((packed as Packed<'UserDetailed'>).followingCount).toBe(0);
		});

		test('shows follower counts when ffVisibility is followers and viewer is not following', async () => {
			const user = createUser({ id: 'target', followersCount: 100, followingCount: 200 });
			followingsRepository.count.mockResolvedValueOnce(0);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile({ ffVisibility: 'followers' }));

			const packed = await service.pack(user, { id: 'me' }, { detail: true });

			expect((packed as Packed<'UserDetailed'>).followersCount).toBe(0);
			expect((packed as Packed<'UserDetailed'>).followingCount).toBe(0);
		});
	});

	describe('packMany', () => {
		test('packs multiple users', async () => {
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const users = [createUser({ id: 'user1', username: 'a' }), createUser({ id: 'user2', username: 'b' })];
			const packed = await service.packMany(users, null, { detail: true });

			expect(packed).toHaveLength(2);
			expect(packed[0].id).toBe('user1');
			expect(packed[1].id).toBe('user2');
		});
	});

	describe('getRelation', () => {
		test('returns true for all relation flags', async () => {
			followingsRepository.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
			followRequestsRepository.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
			blockingsRepository.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
			mutingsRepository.count.mockResolvedValueOnce(1);
			renoteMutingsRepository.count.mockResolvedValueOnce(1);

			const relation = await service.getRelation('me', 'target');

			expect(relation.isFollowing).toBe(true);
			expect(relation.isFollowed).toBe(true);
			expect(relation.hasPendingFollowRequestFromYou).toBe(true);
			expect(relation.hasPendingFollowRequestToYou).toBe(true);
			expect(relation.isBlocking).toBe(true);
			expect(relation.isBlocked).toBe(true);
			expect(relation.isMuted).toBe(true);
			expect(relation.isRenoteMuted).toBe(true);
		});
	});

	describe('getOnlineStatus', () => {
		test('returns active for medium elapsed time', () => {
			const user = createUser({ lastActiveDate: new Date(Date.now() - 1000 * 60 * 30) });
			expect(service.getOnlineStatus(user)).toBe('active');
		});
	});

	describe('validators', () => {
		test('validateName rejects overly long name', () => {
			expect(service.validateName('a'.repeat(51))).toBe(false);
		});

		test('validateName rejects empty name', () => {
			expect(service.validateName('')).toBe(false);
		});

		test('validateDescription rejects overly long description', () => {
			expect(service.validateDescription('a'.repeat(1501))).toBe(false);
		});

		test('validateDescription rejects empty description', () => {
			expect(service.validateDescription('')).toBe(false);
		});

		test('validateLocation rejects overly long location', () => {
			expect(service.validateLocation('a'.repeat(51))).toBe(false);
		});

		test('validateLocation rejects empty location', () => {
			expect(service.validateLocation('')).toBe(false);
		});
	});

	describe('pack', () => {
		test('skips avatar migration when avatarUrl already set', async () => {
			const user = createUser({ avatarId: 'avatar1', avatarUrl: 'https://example.com/avatar.png' });
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			await service.pack(user, null, { detail: true });

			expect(driveFilesRepository.findOneByOrFail).not.toHaveBeenCalled();
			expect(usersRepository.update).not.toHaveBeenCalled();
		});

		test('skips banner migration when bannerUrl already set', async () => {
			const user = createUser({ bannerId: 'banner1', bannerUrl: 'https://example.com/banner.png' });
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			await service.pack(user, null, { detail: true });

			expect(driveFilesRepository.findOneByOrFail).not.toHaveBeenCalled();
			expect(usersRepository.update).not.toHaveBeenCalled();
		});

		test('handles null movedTo resolution', async () => {
			const user = createUser({ host: 'remote.example', movedToUri: 'https://new.example/user' });
			apPersonService.resolvePerson.mockResolvedValue(null);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack(user, null, { detail: true });

			expect((packed as Packed<'UserDetailed'>).movedTo).toBeNull();
		});

		test('includes moderationNote when viewer is moderator', async () => {
			const user = createUser();
			roleService.isModerator.mockResolvedValue(true);
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile({ moderationNote: 'note' }));

			const packed = await service.pack(user, { id: 'me' }, { detail: true });

			expect((packed as Packed<'MeDetailed'>).moderationNote).toBe('note');
		});

		test('packs securityKeys when twoFactorEnabled is true', async () => {
			const user = createUser();
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile({ twoFactorEnabled: true }));
			userSecurityKeysRepository.countBy.mockResolvedValue(1);

			const packed = await service.pack(user, { id: 'user1' }, { detail: true });

			expect((packed as Packed<'MeDetailed'>).securityKeys).toBe(true);
		});

		test('returns null alsoKnownAs for empty array', async () => {
			const user = createUser({ host: 'remote.example', alsoKnownAs: [] });
			userProfilesRepository.findOneByOrFail.mockResolvedValue(createUserProfile());

			const packed = await service.pack(user, null, { detail: true });

			expect((packed as Packed<'UserDetailed'>).alsoKnownAs).toBeNull();
		});
	});

	describe('getHasUnreadAntenna', () => {
		test('returns false', async () => {
			const result = await service.getHasUnreadAntenna('user1');
			expect(result).toBe(false);
		});
	});
});
