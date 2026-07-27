process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { CacheService } from '@/core/CacheService.js';
import type { Redis } from 'ioredis';
import type { UsersRepository, UserProfilesRepository, MutingsRepository, BlockingsRepository, RenoteMutingsRepository, FollowingsRepository } from '@/models/index.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { User, LocalUser } from '@/models/entities/User.js';

function createService() {
	const redisClient = {
		on: jest.fn(),
		off: jest.fn(),
	} as unknown as jest.Mocked<Redis>;

	const redisForSub = {
		on: jest.fn(),
		off: jest.fn(),
	} as unknown as jest.Mocked<Redis>;

	const usersRepository = {
		findOneByOrFail: jest.fn(),
	} as unknown as jest.Mocked<UsersRepository>;

	const userProfilesRepository = {} as unknown as UserProfilesRepository;
	const mutingsRepository = {} as unknown as MutingsRepository;
	const blockingsRepository = {} as unknown as BlockingsRepository;
	const renoteMutingsRepository = {} as unknown as RenoteMutingsRepository;
	const followingsRepository = {} as unknown as FollowingsRepository;

	const userEntityService = {
		isLocalUser: jest.fn().mockReturnValue(false),
	} as unknown as jest.Mocked<UserEntityService>;

	const service = new CacheService(
		redisClient,
		redisForSub,
		usersRepository,
		userProfilesRepository,
		mutingsRepository,
		blockingsRepository,
		renoteMutingsRepository,
		followingsRepository,
		userEntityService,
	);

	return {
		service,
		mocks: {
			redisClient,
			redisForSub,
			usersRepository,
			userEntityService,
		},
	};
}

function createLocalUser(data: Partial<User> = {}): LocalUser {
	return {
		id: 'user1',
		host: null,
		token: 'token1',
		followingCount: 0,
		followersCount: 0,
		...data,
	} as unknown as LocalUser;
}

function createRemoteUser(data: Partial<User> = {}): User {
	return {
		id: 'user2',
		host: 'remote.example',
		followingCount: 0,
		followersCount: 0,
		...data,
	} as unknown as User;
}

describe('CacheService', () => {
	test('registers message listener on redisForSub', () => {
		const { mocks } = createService();
		expect(mocks.redisForSub.on).toHaveBeenCalledWith('message', expect.any(Function));
	});

	describe('onMessage', () => {
		test('ignores non-internal channels', async () => {
			const { service, mocks } = createService();
			const handler = mocks.redisForSub.on.mock.calls.find(([event]) => event === 'message')![1] as (channel: string, data: string) => Promise<void>;

			await handler('test', JSON.stringify({ channel: 'not-internal', message: {} }));

			expect(mocks.usersRepository.findOneByOrFail).not.toHaveBeenCalled();
		});

		test('handles userChangeSuspendedState for remote user', async () => {
			const { service, mocks } = createService();
			const user = createRemoteUser();
			mocks.usersRepository.findOneByOrFail.mockResolvedValue(user);
			const handler = mocks.redisForSub.on.mock.calls.find(([event]) => event === 'message')![1] as (channel: string, data: string) => Promise<void>;

			await handler('test', JSON.stringify({ channel: 'internal', message: { type: 'userChangeSuspendedState', body: { id: user.id } } }));

			expect(service.userByIdCache.get(user.id)).toEqual(user);
		});

		test('handles remoteUserUpdated for local user', async () => {
			const { service, mocks } = createService();
			const user = createLocalUser();
			mocks.userEntityService.isLocalUser.mockReturnValue(true);
			mocks.usersRepository.findOneByOrFail.mockResolvedValue(user);
			const handler = mocks.redisForSub.on.mock.calls.find(([event]) => event === 'message')![1] as (channel: string, data: string) => Promise<void>;

			await handler('test', JSON.stringify({ channel: 'internal', message: { type: 'remoteUserUpdated', body: { id: user.id } } }));

			expect(service.localUserByNativeTokenCache.get(user.token!)).toEqual(user);
			expect(service.localUserByIdCache.get(user.id)).toEqual(user);
		});

		test('handles userTokenRegenerated', async () => {
			const { service, mocks } = createService();
			const user = createLocalUser();
			mocks.usersRepository.findOneByOrFail.mockResolvedValue(user);
			const handler = mocks.redisForSub.on.mock.calls.find(([event]) => event === 'message')![1] as (channel: string, data: string) => Promise<void>;

			service.localUserByNativeTokenCache.set('old-token', user);
			await handler('test', JSON.stringify({ channel: 'internal', message: { type: 'userTokenRegenerated', body: { id: user.id, oldToken: 'old-token', newToken: 'new-token' } } }));

			expect(service.localUserByNativeTokenCache.get('old-token')).toBeUndefined();
			expect(service.localUserByNativeTokenCache.get('new-token')).toEqual(user);
		});

		test('handles follow message updating counts', async () => {
			const { service, mocks } = createService();
			const follower = createLocalUser({ id: 'follower', followingCount: 1 });
			const followee = createLocalUser({ id: 'followee', followersCount: 2 });
			service.userByIdCache.set(follower.id, follower);
			service.userByIdCache.set(followee.id, followee);
			const handler = mocks.redisForSub.on.mock.calls.find(([event]) => event === 'message')![1] as (channel: string, data: string) => Promise<void>;

			await handler('test', JSON.stringify({ channel: 'internal', message: { type: 'follow', body: { followerId: follower.id, followeeId: followee.id } } }));

			expect(follower.followingCount).toBe(2);
			expect(followee.followersCount).toBe(3);
		});

		test('handles unknown internal message type', async () => {
			const { service, mocks } = createService();
			const handler = mocks.redisForSub.on.mock.calls.find(([event]) => event === 'message')![1] as (channel: string, data: string) => Promise<void>;

			await handler('test', JSON.stringify({ channel: 'internal', message: { type: 'unknownType', body: {} } }));

			expect(mocks.usersRepository.findOneByOrFail).not.toHaveBeenCalled();
		});
	});

	test('findUserById fetches from repository on cache miss', async () => {
		const { service, mocks } = createService();
		const user = createLocalUser();
		mocks.usersRepository.findOneByOrFail.mockResolvedValue(user);

		const result = await service.findUserById(user.id);

		expect(result).toEqual(user);
		expect(mocks.usersRepository.findOneByOrFail).toHaveBeenCalledWith({ id: user.id });
	});

	test('userByIdCache stores local user as ID reference', () => {
		const { service, mocks } = createService();
		const user = createLocalUser();
		mocks.userEntityService.isLocalUser.mockReturnValue(true);

		service.userByIdCache.set(user.id, user);

		expect(service.userByIdCache.get(user.id)).toEqual(user);
		expect(service.localUserByIdCache.get(user.id)).toEqual(user);
	});

	test('uriPersonCache converts local user to ID and resolves back', () => {
		const { service, mocks } = createService();
		const user = createLocalUser();
		mocks.userEntityService.isLocalUser.mockReturnValue(true);
		service.userByIdCache.set(user.id, user);

		service.uriPersonCache.set('uri1', user);

		expect(service.uriPersonCache.get('uri1')).toEqual(user);
	});

	test('dispose removes listener and disposes caches', () => {
		const { service, mocks } = createService();

		service.dispose();

		expect(mocks.redisForSub.off).toHaveBeenCalledWith('message', expect.any(Function));
	});

	test('onApplicationShutdown disposes service', () => {
		const { service, mocks } = createService();

		service.onApplicationShutdown();

		expect(mocks.redisForSub.off).toHaveBeenCalled();
	});
});
