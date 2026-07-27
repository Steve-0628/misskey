process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import UpdateEndpoint from '@/server/api/endpoints/i/update.js';
import { ApiError } from '@/server/api/error.js';
import type { UsersRepository, DriveFilesRepository, UserProfilesRepository } from '@/models/index.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { UserFollowingService } from '@/core/UserFollowingService.js';
import type { AccountUpdateService } from '@/core/AccountUpdateService.js';
import type { AccountMoveService } from '@/core/AccountMoveService.js';
import type { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import type { ApiLoggerService } from '@/server/api/ApiLoggerService.js';
import type { HashtagService } from '@/core/HashtagService.js';
import type { RoleService, RolePolicies } from '@/core/RoleService.js';
import type { CacheService } from '@/core/CacheService.js';
import type { LocalUser, User } from '@/models/entities/User.js';
import type { UserProfile } from '@/models/entities/UserProfile.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';

function createLocalUser(data: Partial<User> = {}): LocalUser {
	return {
		id: 'user1',
		createdAt: new Date(),
		updatedAt: new Date(),
		lastFetchedAt: null,
		lastActiveDate: new Date(),
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
		isLocked: true,
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
		token: 'user-token',
		...data,
	} as unknown as LocalUser;
}

function createProfile(data: Partial<UserProfile> = {}): UserProfile {
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
		emailNotificationTypes: ['follow', 'receiveFollowRequest'],
		publicReactions: true,
		ffVisibility: 'public',
		twoFactorTempSecret: null,
		twoFactorSecret: null,
		twoFactorEnabled: false,
		securityKeysAvailable: false,
		usePasswordLessLogin: false,
		password: 'hashed-password',
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

function createDriveFile(data: Partial<DriveFile> = {}): DriveFile {
	return {
		id: 'file1',
		createdAt: new Date(),
		userId: 'user1',
		user: null,
		name: 'test.png',
		type: 'image/png',
		md5: 'md5',
		size: 0,
		host: null,
		digest: null,
		isSensitive: false,
		properties: {},
		blurhash: 'blurhash',
		comment: null,
		folderId: null,
		folder: null,
		type: 'image/png',
		...data,
	} as unknown as DriveFile;
}

function createDefaultPolicies(): RolePolicies {
	return {
		gtlAvailable: true,
		ltlAvailable: true,
		canPublicNote: true,
		canInvite: false,
		inviteLimit: 0,
		inviteLimitCycle: 60 * 24 * 7,
		inviteExpirationTime: 0,
		canManageCustomEmojis: false,
		canSearchNotes: false,
		driveCapacityMb: 100,
		alwaysMarkNsfw: false,
		pinLimit: 5,
		antennaLimit: 5,
		wordMuteLimit: 200,
		webhookLimit: 3,
		userListLimit: 10,
		userEachUserListsLimit: 50,
		rateLimitFactor: 1,
	};
}

describe('api:i/update', () => {
	function createEndpoint() {
		const usersRepository = {
			findOneByOrFail: jest.fn().mockResolvedValue(createLocalUser()),
			update: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<UsersRepository>;

		const userProfilesRepository = {
			findOneByOrFail: jest.fn().mockResolvedValue(createProfile()),
			update: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<UserProfilesRepository>;

		const driveFilesRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<DriveFilesRepository>;

		const userEntityService = {
			pack: jest.fn().mockResolvedValue({ id: 'user1', username: 'alice' }),
			getUserUri: jest.fn().mockReturnValue('https://remote.example.com/users/bob'),
			genLocalUserUri: jest.fn().mockReturnValue('https://example.com/users/alice'),
		} as unknown as jest.Mocked<UserEntityService>;

		const driveFileEntityService = {
			getPublicUrl: jest.fn().mockReturnValue('https://example.com/files/file1'),
		} as unknown as jest.Mocked<DriveFileEntityService>;

		const globalEventService = {
			publishMainStream: jest.fn(),
		} as unknown as jest.Mocked<GlobalEventService>;

		const userFollowingService = {
			acceptAllFollowRequests: jest.fn(),
		} as unknown as jest.Mocked<UserFollowingService>;

		const accountUpdateService = {
			publishToFollowers: jest.fn(),
		} as unknown as jest.Mocked<AccountUpdateService>;

		const accountMoveService = {} as unknown as jest.Mocked<AccountMoveService>;

		const remoteUserResolveService = {
			resolveUser: jest.fn(),
		} as unknown as jest.Mocked<RemoteUserResolveService>;

		const apiLoggerService = {
			logger: {
				warn: jest.fn(),
			},
		} as unknown as jest.Mocked<ApiLoggerService>;

		const hashtagService = {
			updateUsertags: jest.fn(),
		} as unknown as jest.Mocked<HashtagService>;

		const roleService = {
			getUserPolicies: jest.fn().mockResolvedValue(createDefaultPolicies()),
		} as unknown as jest.Mocked<RoleService>;

		const cacheService = {
			userProfileCache: {
				set: jest.fn(),
			},
			uriPersonCache: {
				set: jest.fn(),
			},
		} as unknown as jest.Mocked<CacheService>;

		const endpoint = new UpdateEndpoint(
			usersRepository,
			userProfilesRepository,
			driveFilesRepository,
			userEntityService,
			driveFileEntityService,
			globalEventService,
			userFollowingService,
			accountUpdateService,
			accountMoveService,
			remoteUserResolveService,
			apiLoggerService,
			hashtagService,
			roleService,
			cacheService,
		);

		return {
			endpoint,
			usersRepository,
			userProfilesRepository,
			driveFilesRepository,
			userEntityService,
			driveFileEntityService,
			globalEventService,
			userFollowingService,
			accountUpdateService,
			remoteUserResolveService,
			apiLoggerService,
			hashtagService,
			roleService,
			cacheService,
		};
	}

	test('updates basic fields', async () => {
		const { endpoint, userProfilesRepository, usersRepository, userEntityService, globalEventService } = createEndpoint();

		const result = await endpoint.exec({
			name: 'Alice',
			description: 'Hello world',
			location: 'Earth',
			birthday: '1990-01-01',
			lang: 'en',
			isLocked: false,
			isBot: true,
		}, createLocalUser(), null);

		expect(usersRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({
			name: 'Alice',
			isLocked: false,
			isBot: true,
		}));
		expect(userProfilesRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({
			description: 'Hello world',
			location: 'Earth',
			birthday: '1990-01-01',
			lang: 'en',
		}));
		expect(globalEventService.publishMainStream).toHaveBeenCalledWith('user1', 'meUpdated', expect.anything());
		expect(userEntityService.pack).toHaveBeenCalledWith('user1', expect.anything(), { detail: true, includeSecrets: true });
		expect(result).toEqual({ id: 'user1', username: 'alice' });
	});

	test('accepts all follow requests when unlocking account', async () => {
		const { endpoint, userFollowingService } = createEndpoint();
		const user = createLocalUser({ isLocked: true });

		await endpoint.exec({ isLocked: false }, user, null);

		expect(userFollowingService.acceptAllFollowRequests).toHaveBeenCalledWith(expect.objectContaining({ id: 'user1' }));
	});

	test('throws noSuchAvatar when avatar file does not exist', async () => {
		const { endpoint, driveFilesRepository } = createEndpoint();
		driveFilesRepository.findOneBy.mockResolvedValue(null);

		await expect(endpoint.exec({ avatarId: 'file1' }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ avatarId: 'file1' }, createLocalUser(), null)).rejects.toMatchObject({ code: 'NO_SUCH_AVATAR' });
	});

	test('throws noSuchAvatar when avatar file belongs to another user', async () => {
		const { endpoint, driveFilesRepository } = createEndpoint();
		driveFilesRepository.findOneBy.mockResolvedValue(createDriveFile({ userId: 'user2' }));

		await expect(endpoint.exec({ avatarId: 'file1' }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ avatarId: 'file1' }, createLocalUser(), null)).rejects.toMatchObject({ code: 'NO_SUCH_AVATAR' });
	});

	test('throws avatarNotAnImage when avatar is not an image', async () => {
		const { endpoint, driveFilesRepository } = createEndpoint();
		driveFilesRepository.findOneBy.mockResolvedValue(createDriveFile({ type: 'application/pdf' }));

		await expect(endpoint.exec({ avatarId: 'file1' }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ avatarId: 'file1' }, createLocalUser(), null)).rejects.toMatchObject({ code: 'AVATAR_NOT_AN_IMAGE' });
	});

	test('updates avatar with valid image file', async () => {
		const { endpoint, driveFilesRepository, usersRepository, driveFileEntityService } = createEndpoint();
		driveFilesRepository.findOneBy.mockResolvedValueOnce(createDriveFile());

		await endpoint.exec({ avatarId: 'file1' }, createLocalUser(), null);

		expect(driveFileEntityService.getPublicUrl).toHaveBeenCalledWith(expect.anything(), 'avatar');
		expect(usersRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({
			avatarId: 'file1',
			avatarUrl: 'https://example.com/files/file1',
			avatarBlurhash: 'blurhash',
		}));
	});

	test('clears avatar when avatarId is null', async () => {
		const { endpoint, usersRepository } = createEndpoint();

		await endpoint.exec({ avatarId: null }, createLocalUser(), null);

		expect(usersRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({
			avatarId: null,
			avatarUrl: null,
			avatarBlurhash: null,
		}));
	});

	test('throws noSuchBanner when banner file does not exist', async () => {
		const { endpoint, driveFilesRepository } = createEndpoint();
		driveFilesRepository.findOneBy.mockResolvedValue(null);

		await expect(endpoint.exec({ bannerId: 'file1' }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ bannerId: 'file1' }, createLocalUser(), null)).rejects.toMatchObject({ code: 'NO_SUCH_BANNER' });
	});

	test('throws bannerNotAnImage when banner is not an image', async () => {
		const { endpoint, driveFilesRepository } = createEndpoint();
		driveFilesRepository.findOneBy.mockResolvedValue(createDriveFile({ type: 'application/pdf' }));

		await expect(endpoint.exec({ bannerId: 'file1' }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ bannerId: 'file1' }, createLocalUser(), null)).rejects.toMatchObject({ code: 'BANNER_NOT_AN_IMAGE' });
	});

	test('updates banner with valid image file', async () => {
		const { endpoint, driveFilesRepository, usersRepository } = createEndpoint();
		driveFilesRepository.findOneBy.mockResolvedValueOnce(createDriveFile());

		await endpoint.exec({ bannerId: 'file1' }, createLocalUser(), null);

		expect(usersRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({
			bannerId: 'file1',
			bannerUrl: 'https://example.com/files/file1',
			bannerBlurhash: 'blurhash',
		}));
	});

	test('throws tooManyMutedWords when muted words exceed policy limit', async () => {
		const { endpoint, roleService } = createEndpoint();
		roleService.getUserPolicies.mockResolvedValue({ ...createDefaultPolicies(), wordMuteLimit: 5 });

		await expect(endpoint.exec({ mutedWords: [['verylongword']] }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ mutedWords: [['verylongword']] }, createLocalUser(), null)).rejects.toMatchObject({ code: 'TOO_MANY_MUTED_WORDS' });
	});

	test('throws invalidRegexp when muted words contain invalid regex', async () => {
		const { endpoint } = createEndpoint();

		await expect(endpoint.exec({ mutedWords: ['/(/'] }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ mutedWords: ['/(/'] }, createLocalUser(), null)).rejects.toMatchObject({ code: 'INVALID_REGEXP' });
	});

	test('stores muted words and enables word mute', async () => {
		const { endpoint, userProfilesRepository } = createEndpoint();

		await endpoint.exec({ mutedWords: [['word']] }, createLocalUser(), null);

		expect(userProfilesRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({
			mutedWords: [['word']],
			enableWordMute: true,
		}));
	});

	test('throws restrictedByRole when setting alwaysMarkNsfw is not allowed', async () => {
		const { endpoint, roleService } = createEndpoint();
		roleService.getUserPolicies.mockResolvedValue({ ...createDefaultPolicies(), alwaysMarkNsfw: true });

		await expect(endpoint.exec({ alwaysMarkNsfw: true }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ alwaysMarkNsfw: true }, createLocalUser(), null)).rejects.toMatchObject({ code: 'RESTRICTED_BY_ROLE' });
	});

	test('filters empty fields', async () => {
		const { endpoint, userProfilesRepository } = createEndpoint();

		await endpoint.exec({
			fields: [
				{ name: 'Valid', value: 'Value' },
				{ name: '', value: 'Empty name' },
				{ name: 'Empty value', value: '' },
			],
		}, createLocalUser(), null);

		expect(userProfilesRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({
			fields: [{ name: 'Valid', value: 'Value' }],
		}));
	});

	test('throws YOUR_ACCOUNT_MOVED when setting alsoKnownAs after account move', async () => {
		const { endpoint } = createEndpoint();
		const user = createLocalUser({ movedToUri: 'https://remote.example.com/users/alice' });

		await expect(endpoint.exec({ alsoKnownAs: ['@bob@remote.example.com'] }, user, null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ alsoKnownAs: ['@bob@remote.example.com'] }, user, null)).rejects.toMatchObject({ code: 'YOUR_ACCOUNT_MOVED' });
	});

	test('throws noSuchUser when alsoKnownAs target cannot be resolved', async () => {
		const { endpoint, remoteUserResolveService, apiLoggerService } = createEndpoint();
		remoteUserResolveService.resolveUser.mockRejectedValue(new Error('not found'));

		await expect(endpoint.exec({ alsoKnownAs: ['@bob@remote.example.com'] }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ alsoKnownAs: ['@bob@remote.example.com'] }, createLocalUser(), null)).rejects.toMatchObject({ code: 'NO_SUCH_USER' });
		expect(apiLoggerService.logger.warn).toHaveBeenCalled();
	});

	test('throws forbiddenToSetYourself when alsoKnownAs target is self', async () => {
		const { endpoint, remoteUserResolveService } = createEndpoint();
		remoteUserResolveService.resolveUser.mockResolvedValue(createLocalUser({ id: 'user1', host: 'example.com', uri: 'https://example.com/users/alice' }));

		await expect(endpoint.exec({ alsoKnownAs: ['@alice@example.com'] }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ alsoKnownAs: ['@alice@example.com'] }, createLocalUser(), null)).rejects.toMatchObject({ code: 'FORBIDDEN_TO_SET_YOURSELF' });
	});

	test('throws uriNull when alsoKnownAs target URI is null', async () => {
		const { endpoint, remoteUserResolveService, userEntityService } = createEndpoint();
		remoteUserResolveService.resolveUser.mockResolvedValue(createLocalUser({ id: 'user2', host: 'remote.example.com', uri: 'https://remote.example.com/users/bob' }));
		userEntityService.getUserUri.mockReturnValue(null);

		await expect(endpoint.exec({ alsoKnownAs: ['@bob@remote.example.com'] }, createLocalUser(), null)).rejects.toThrow(ApiError);
		await expect(endpoint.exec({ alsoKnownAs: ['@bob@remote.example.com'] }, createLocalUser(), null)).rejects.toMatchObject({ code: 'URI_NULL' });
	});

	test('updates alsoKnownAs with resolved targets', async () => {
		const { endpoint, remoteUserResolveService, usersRepository, cacheService } = createEndpoint();
		remoteUserResolveService.resolveUser.mockResolvedValueOnce(createLocalUser({ id: 'user2', host: 'remote.example.com', uri: 'https://remote.example.com/users/bob' }));

		await endpoint.exec({ alsoKnownAs: ['@bob@remote.example.com'] }, createLocalUser(), null);

		expect(usersRepository.update).toHaveBeenCalledWith('user1', expect.objectContaining({
			alsoKnownAs: ['https://remote.example.com/users/bob'],
		}));
		expect(cacheService.uriPersonCache.set).toHaveBeenCalled();
	});
});
