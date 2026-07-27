process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { UserFollowingService } from '@/core/UserFollowingService.js';
import type { ModuleRef } from '@nestjs/core';
import type { Config } from '@/config.js';
import type { FollowingsRepository, FollowRequestsRepository, InstancesRepository, UserProfilesRepository, UsersRepository } from '@/models/index.js';
import type { CacheService } from '@/core/CacheService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { IdService } from '@/core/IdService.js';
import type { QueueService } from '@/core/QueueService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { MetaService } from '@/core/MetaService.js';
import type { NotificationService } from '@/core/NotificationService.js';
import type { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import type { WebhookService } from '@/core/WebhookService.js';
import type { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import type { AccountMoveService } from '@/core/AccountMoveService.js';
import type PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import type InstanceChart from '@/core/chart/charts/instance.js';
import type { User, LocalUser, RemoteUser } from '@/models/entities/User.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { QueryFailedError } from 'typeorm';

function createLocalUser(id: string, data: Partial<LocalUser> = {}): LocalUser {
	return {
		id,
		host: null,
		username: `user${id}`,
		usernameLower: `user${id}`,
		isBot: false,
		movedToUri: null,
		...data,
	} as unknown as LocalUser;
}

function createRemoteUser(id: string, host: string, data: Partial<RemoteUser> = {}): RemoteUser {
	return {
		id,
		host,
		username: `user${id}`,
		usernameLower: `user${id}`,
		isBot: false,
		inbox: `https://${host}/inbox`,
		sharedInbox: `https://${host}/sharedInbox`,
		uri: `https://${host}/users/${id}`,
		movedToUri: null,
		...data,
	} as unknown as RemoteUser;
}

function createUserEntityService(): jest.Mocked<UserEntityService> {
	return {
		isLocalUser: jest.fn().mockImplementation((user: User) => user.host === null),
		isRemoteUser: jest.fn().mockImplementation((user: User) => user.host !== null),
		pack: jest.fn().mockResolvedValue({ id: 'user1' }),
	} as unknown as jest.Mocked<UserEntityService>;
}

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const userBlockingService = {
		checkBlocked: jest.fn().mockResolvedValue(false),
		unblock: jest.fn().mockResolvedValue(undefined),
	};

	const moduleRef = {
		get: jest.fn().mockReturnValue(userBlockingService),
	} as unknown as ModuleRef;

	const usersRepository = {
		findOneByOrFail: jest.fn().mockImplementation(({ id }: { id: string }) => createLocalUser(id)),
		findOneBy: jest.fn().mockImplementation(({ id }: { id: string }) => createLocalUser(id)),
		increment: jest.fn().mockResolvedValue(undefined),
		decrement: jest.fn().mockResolvedValue(undefined),
		update: jest.fn().mockResolvedValue(undefined),
		exist: jest.fn().mockResolvedValue(false),
	} as unknown as jest.Mocked<UsersRepository>;

	const userProfilesRepository = {
		findOneByOrFail: jest.fn().mockResolvedValue({
			carefulBot: false,
			autoAcceptFollowed: false,
		}),
	} as unknown as jest.Mocked<UserProfilesRepository>;

	const followingsRepository = {
		findOne: jest.fn().mockResolvedValue(null),
		findBy: jest.fn().mockResolvedValue([]),
		insert: jest.fn().mockResolvedValue(undefined),
		delete: jest.fn().mockResolvedValue(undefined),
		exist: jest.fn().mockResolvedValue(false),
		count: jest.fn().mockResolvedValue(0),
	} as unknown as jest.Mocked<FollowingsRepository>;

	const followRequestsRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
		findOneByOrFail: jest.fn().mockResolvedValue({ id: 'req1' }),
		findBy: jest.fn().mockResolvedValue([]),
		insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'req1' }] }),
		delete: jest.fn().mockResolvedValue(undefined),
		exist: jest.fn().mockResolvedValue(false),
	} as unknown as jest.Mocked<FollowRequestsRepository>;

	const instancesRepository = {
		increment: jest.fn().mockResolvedValue(undefined),
		decrement: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<InstancesRepository>;

	const cacheService = {
		userFollowingsCache: { refresh: jest.fn() },
	} as unknown as CacheService;

	const userEntityService = createUserEntityService();

	const idService = {
		genId: jest.fn().mockReturnValue('id1'),
	} as unknown as IdService;

	const queueService = {
		deliver: jest.fn(),
		webhookDeliver: jest.fn(),
	} as unknown as QueueService;

	const globalEventService = {
		publishInternalEvent: jest.fn(),
		publishMainStream: jest.fn(),
	} as unknown as GlobalEventService;

	const metaService = {
		fetch: jest.fn().mockResolvedValue({ enableChartsForFederatedInstances: false }),
	} as unknown as MetaService;

	const notificationService = {
		createNotification: jest.fn(),
	} as unknown as NotificationService;

	const federatedInstanceService = {
		fetch: jest.fn().mockResolvedValue({ id: 'instance1', host: 'remote.example' }),
	} as unknown as FederatedInstanceService;

	const webhookService = {
		getActiveWebhooks: jest.fn().mockResolvedValue([]),
	} as unknown as WebhookService;

	const apRendererService = {
		addContext: jest.fn().mockImplementation(x => x),
		renderFollow: jest.fn().mockReturnValue({ type: 'Follow' }),
		renderAccept: jest.fn().mockReturnValue({ type: 'Accept' }),
		renderReject: jest.fn().mockReturnValue({ type: 'Reject' }),
		renderUndo: jest.fn().mockReturnValue({ type: 'Undo' }),
	} as unknown as ApRendererService;

	const accountMoveService = {
		validateAlsoKnownAs: jest.fn().mockResolvedValue(false),
	} as unknown as AccountMoveService;

	const perUserFollowingChart = {
		update: jest.fn(),
	} as unknown as PerUserFollowingChart;

	const instanceChart = {
		updateFollowing: jest.fn(),
		updateFollowers: jest.fn(),
	} as unknown as InstanceChart;

	const service = new UserFollowingService(
		moduleRef,
		config,
		usersRepository,
		userProfilesRepository,
		followingsRepository,
		followRequestsRepository,
		instancesRepository,
		cacheService,
		userEntityService,
		idService,
		queueService,
		globalEventService,
		metaService,
		notificationService,
		federatedInstanceService,
		webhookService,
		apRendererService,
		accountMoveService,
		perUserFollowingChart,
		instanceChart,
	);

	service.onModuleInit();

	return {
		service,
		mocks: {
			moduleRef,
			usersRepository,
			userProfilesRepository,
			followingsRepository,
			followRequestsRepository,
			instancesRepository,
			cacheService,
			userEntityService,
			idService,
			queueService,
			globalEventService,
			metaService,
			notificationService,
			federatedInstanceService,
			webhookService,
			apRendererService,
			accountMoveService,
			perUserFollowingChart,
			instanceChart,
			userBlockingService,
		},
	};
}

describe('UserFollowingService', () => {
	describe('follow', () => {
		test('local user follows local user', async () => {
			const { service, mocks } = createService();
			const follower = createLocalUser('follower');
			const followee = createLocalUser('followee');

			await service.follow(follower, followee);

			expect(mocks.followingsRepository.insert).toHaveBeenCalled();
			expect(mocks.globalEventService.publishInternalEvent).toHaveBeenCalledWith('follow', { followerId: 'follower', followeeId: 'followee' });
		});

		test('remote follower follows local followee and is accepted', async () => {
			const { service, mocks } = createService();
			mocks.userBlockingService.checkBlocked.mockResolvedValue(false);
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'follower' ? createRemoteUser('follower', 'remote.example') : createLocalUser('followee'));
			const follower = createRemoteUser('follower', 'remote.example');
			const followee = createLocalUser('followee');

			await service.follow(follower, followee, 'req1');

			expect(mocks.followingsRepository.insert).toHaveBeenCalled();
			expect(mocks.apRendererService.renderAccept).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});

		test('locked followee with carefulBot rejects bot follower', async () => {
			const { service, mocks } = createService();
			mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue({ carefulBot: true, autoAcceptFollowed: false });
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'followee' ? { ...createLocalUser('followee'), isLocked: true } : createLocalUser('follower', { isBot: true }));
			const follower = createLocalUser('follower', { isBot: true });
			const followee = { ...createLocalUser('followee'), isLocked: true };

			await service.follow(follower, followee);

			expect(mocks.followRequestsRepository.insert).toHaveBeenCalled();
			expect(mocks.followingsRepository.insert).not.toHaveBeenCalled();
		});

		test('locked followee auto-accepts follower who is followed back', async () => {
			const { service, mocks } = createService();
			mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue({ carefulBot: false, autoAcceptFollowed: true });
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'followee' ? { ...createLocalUser('followee'), isLocked: true } : createLocalUser('follower'));
			mocks.followingsRepository.exist.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
			const follower = createLocalUser('follower');
			const followee = { ...createLocalUser('followee'), isLocked: true };

			await service.follow(follower, followee);

			expect(mocks.followingsRepository.insert).toHaveBeenCalled();
			expect(mocks.followRequestsRepository.insert).not.toHaveBeenCalled();
		});

		test('throws when blocking', async () => {
			const { service, mocks } = createService();
			mocks.userBlockingService.checkBlocked.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
			const follower = createLocalUser('follower');
			const followee = createLocalUser('followee');

			await expect(service.follow(follower, followee)).rejects.toBeInstanceOf(IdentifiableError);
		});

		test('remote follower blocked by local followee sends Reject', async () => {
			const { service, mocks } = createService();
			mocks.userBlockingService.checkBlocked.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'follower' ? createRemoteUser('follower', 'remote.example') : createLocalUser('followee'));
			const follower = createRemoteUser('follower', 'remote.example');
			const followee = createLocalUser('followee');

			await service.follow(follower, followee, 'req1');

			expect(mocks.apRendererService.renderReject).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});

		test('remote follower blocking local followee unblocks', async () => {
			const { service, mocks } = createService();
			mocks.userBlockingService.checkBlocked.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'follower' ? createRemoteUser('follower', 'remote.example') : createLocalUser('followee'));
			const follower = createRemoteUser('follower', 'remote.example');
			const followee = createLocalUser('followee');

			await service.follow(follower, followee);

			expect(mocks.userBlockingService.unblock).toHaveBeenCalled();
		});

		test('locked followee creates follow request', async () => {
			const { service, mocks } = createService();
			mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue({ carefulBot: false, autoAcceptFollowed: false });
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'followee' ? { ...createLocalUser('followee'), isLocked: true } : createLocalUser('follower'));
			const follower = createLocalUser('follower');
			const followee = { ...createLocalUser('followee'), isLocked: true };

			await service.follow(follower, followee);

			expect(mocks.followRequestsRepository.insert).toHaveBeenCalled();
		});

		test('autoAccept when already following', async () => {
			const { service, mocks } = createService();
			mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue({ carefulBot: false, autoAcceptFollowed: false });
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'followee' ? { ...createLocalUser('followee'), isLocked: true } : createLocalUser('follower'));
			mocks.followingsRepository.exist.mockResolvedValue(true);
			const follower = createLocalUser('follower');
			const followee = { ...createLocalUser('followee'), isLocked: true };

			await service.follow(follower, followee);

			expect(mocks.followingsRepository.insert).toHaveBeenCalled();
		});

		test('local follows remote creates follow request', async () => {
			const { service, mocks } = createService();
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'followee' ? createRemoteUser('followee', 'remote.example') : createLocalUser('follower'));
			const follower = createLocalUser('follower');
			const followee = createRemoteUser('followee', 'remote.example');

			await service.follow(follower, followee);

			expect(mocks.followRequestsRepository.insert).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});
	});

	describe('unfollow', () => {
		test('returns when no following exists', async () => {
			const { service, mocks } = createService();
			mocks.followingsRepository.findOne.mockResolvedValue(null);
			const follower = createLocalUser('follower');
			const followee = createLocalUser('followee');

			await service.unfollow(follower, followee);

			expect(mocks.followingsRepository.delete).not.toHaveBeenCalled();
		});

		test('local unfollows local publishes events', async () => {
			const { service, mocks } = createService();
			mocks.followingsRepository.findOne.mockResolvedValue({
				id: 'following1',
				follower: createLocalUser('follower'),
				followee: createLocalUser('followee'),
			});
			const follower = createLocalUser('follower');
			const followee = createLocalUser('followee');

			await service.unfollow(follower, followee);

			expect(mocks.followingsRepository.delete).toHaveBeenCalled();
			expect(mocks.globalEventService.publishMainStream).toHaveBeenCalled();
		});

		test('local unfollows remote sends Undo', async () => {
			const { service, mocks } = createService();
			mocks.followingsRepository.findOne.mockResolvedValue({
				id: 'following1',
				follower: createLocalUser('follower'),
				followee: createRemoteUser('followee', 'remote.example'),
			});
			const follower = createLocalUser('follower');
			const followee = createRemoteUser('followee', 'remote.example');

			await service.unfollow(follower, followee);

			expect(mocks.apRendererService.renderUndo).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});

		test('remote unfollows local sends Reject', async () => {
			const { service, mocks } = createService();
			mocks.followingsRepository.findOne.mockResolvedValue({
				id: 'following1',
				follower: createRemoteUser('follower', 'remote.example'),
				followee: createLocalUser('followee'),
			});
			const follower = createRemoteUser('follower', 'remote.example');
			const followee = createLocalUser('followee');

			await service.unfollow(follower, followee);

			expect(mocks.apRendererService.renderReject).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});
	});

	describe('insertFollowingDoc', () => {
		test('does nothing on self-follow', async () => {
			const { service, mocks } = createService();
			const user = createLocalUser('user1');

			await (service as any).insertFollowingDoc(user, user);

			expect(mocks.followingsRepository.insert).not.toHaveBeenCalled();
		});

		test('handles duplicate key for remote follower', async () => {
			const { service, mocks } = createService();
			const err = new QueryFailedError('INSERT', [], { code: '23505' } as any);
			(err as any).driverError = { code: '23505' };
			mocks.followingsRepository.insert.mockRejectedValueOnce(err);
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'follower' ? createRemoteUser('follower', 'remote.example') : createLocalUser('followee'));
			const follower = createRemoteUser('follower', 'remote.example');
			const followee = createLocalUser('followee');

			await (service as any).insertFollowingDoc(followee, follower);

			expect(mocks.followingsRepository.insert).toHaveBeenCalled();
			expect(mocks.globalEventService.publishInternalEvent).not.toHaveBeenCalled();
		});
	});

	describe('createFollowRequest', () => {
		test('self request returns early', async () => {
			const { service, mocks } = createService();
			const user = createLocalUser('user1');

			await (service as any).createFollowRequest(user, user);

			expect(mocks.followRequestsRepository.insert).not.toHaveBeenCalled();
		});

		test('local followee receives notification', async () => {
			const { service, mocks } = createService();
			const follower = createLocalUser('follower');
			const followee = createLocalUser('followee');

			await (service as any).createFollowRequest(follower, followee);

			expect(mocks.followRequestsRepository.insert).toHaveBeenCalled();
			expect(mocks.notificationService.createNotification).toHaveBeenCalled();
		});
	});

	describe('cancelFollowRequest', () => {
		test('throws when request not found', async () => {
			const { service, mocks } = createService();
			mocks.followRequestsRepository.exist.mockResolvedValue(false);
			const followee = createRemoteUser('followee', 'remote.example');
			const follower = createLocalUser('follower');

			await expect(service.cancelFollowRequest(followee, follower)).rejects.toBeInstanceOf(IdentifiableError);
		});

		test('local follower cancels remote request and delivers Undo', async () => {
			const { service, mocks } = createService();
			mocks.followRequestsRepository.exist.mockResolvedValue(true);
			mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1', requestId: 'reqid' });
			const followee = createRemoteUser('followee', 'remote.example');
			const follower = createLocalUser('follower');

			await service.cancelFollowRequest(followee, follower);

			expect(mocks.followRequestsRepository.delete).toHaveBeenCalled();
			expect(mocks.apRendererService.renderUndo).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});

		test('cancels remote follow request and delivers Undo', async () => {
			const { service, mocks } = createService();
			mocks.followRequestsRepository.exist.mockResolvedValue(true);
			const followee = createRemoteUser('followee', 'remote.example');
			const follower = createLocalUser('follower');

			await service.cancelFollowRequest(followee, follower);

			expect(mocks.followRequestsRepository.delete).toHaveBeenCalled();
			expect(mocks.apRendererService.renderUndo).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});
	});

	describe('acceptFollowRequest', () => {
		test('throws when request not found', async () => {
			const { service, mocks } = createService();
			mocks.followRequestsRepository.findOneBy.mockResolvedValue(null);
			const followee = createLocalUser('followee');
			const follower = createRemoteUser('follower', 'remote.example');

			await expect(service.acceptFollowRequest(followee, follower)).rejects.toBeInstanceOf(IdentifiableError);
		});

		test('accepts remote follower and delivers Accept', async () => {
			const { service, mocks } = createService();
			mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1', requestId: 'req1' });
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => id === 'follower' ? createRemoteUser('follower', 'remote.example') : createLocalUser('followee'));
			const followee = createLocalUser('followee');
			const follower = createRemoteUser('follower', 'remote.example');

			await service.acceptFollowRequest(followee, follower);

			expect(mocks.followingsRepository.insert).toHaveBeenCalled();
			expect(mocks.apRendererService.renderAccept).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});
	});

	describe('rejectFollowRequest', () => {
		test('rejects remote follower and delivers Reject', async () => {
			const { service, mocks } = createService();
			mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1' });
			mocks.followingsRepository.findOne.mockResolvedValue(null);
			const followee = createLocalUser('followee');
			const follower = createRemoteUser('follower', 'remote.example');

			await service.rejectFollowRequest(followee, follower);

			expect(mocks.apRendererService.renderReject).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});

		test('rejects local follower and publishes unfollow', async () => {
			const { service, mocks } = createService();
			mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1' });
			mocks.followingsRepository.findOne.mockResolvedValue(null);
			const followee = createLocalUser('followee');
			const follower = createLocalUser('follower');

			await service.rejectFollowRequest(followee, follower);

			expect(mocks.globalEventService.publishMainStream).toHaveBeenCalled();
		});
	});

	describe('rejectFollow', () => {
		test('rejects local follower and publishes unfollow', async () => {
			const { service, mocks } = createService();
			mocks.followingsRepository.findOne.mockResolvedValue({ id: 'following1', follower: createLocalUser('follower'), followee: createLocalUser('followee') });
			const followee = createLocalUser('followee');
			const follower = createLocalUser('follower');

			await service.rejectFollow(followee, follower);

			expect(mocks.followingsRepository.delete).toHaveBeenCalled();
			expect(mocks.globalEventService.publishMainStream).toHaveBeenCalled();
		});

		test('rejects remote follower and delivers Reject', async () => {
			const { service, mocks } = createService();
			mocks.followingsRepository.findOne.mockResolvedValue({ id: 'following1', follower: createRemoteUser('follower', 'remote.example'), followee: createLocalUser('followee') });
			const followee = createLocalUser('followee');
			const follower = createRemoteUser('follower', 'remote.example');

			await service.rejectFollow(followee, follower);

			expect(mocks.followingsRepository.delete).toHaveBeenCalled();
			expect(mocks.apRendererService.renderReject).toHaveBeenCalled();
			expect(mocks.queueService.deliver).toHaveBeenCalled();
		});
	});
});
