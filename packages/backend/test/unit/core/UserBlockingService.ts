process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { UserBlockingService } from '@/core/UserBlockingService.js';
import type { Config } from '@/config.js';
import type { BlockingsRepository, FollowRequestsRepository, UserListJoiningsRepository, UserListsRepository } from '@/models/index.js';
import type { CacheService } from '@/core/CacheService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { IdService } from '@/core/IdService.js';
import type { QueueService } from '@/core/QueueService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { WebhookService } from '@/core/WebhookService.js';
import type { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import type { LoggerService } from '@/core/LoggerService.js';
import type { ModuleRef } from '@nestjs/core';
import type { User } from '@/models/entities/User.js';

function createUser(data: Partial<User> = {}): User {
	return {
		id: 'user1',
		host: null,
		inbox: 'https://example.com/inbox',
		...data,
	} as unknown as User;
}

function createService() {
	const moduleRef = {
		get: jest.fn().mockReturnValue({
			unfollow: jest.fn().mockResolvedValue(undefined),
		}),
	} as unknown as ModuleRef;

	const followRequestsRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
		delete: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<FollowRequestsRepository>;

	const blockingsRepository = {
		insert: jest.fn().mockResolvedValue(undefined),
		findOneBy: jest.fn().mockResolvedValue(null),
		delete: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<BlockingsRepository>;

	const userListsRepository = {
		findBy: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<UserListsRepository>;

	const userListJoiningsRepository = {
		delete: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<UserListJoiningsRepository>;

	const cacheService = {
		userBlockingCache: {
			refresh: jest.fn(),
			fetch: jest.fn().mockResolvedValue(new Set()),
		},
		userBlockedCache: {
			refresh: jest.fn(),
		},
	} as unknown as CacheService;

	const userEntityService = {
		isLocalUser: jest.fn().mockReturnValue(true),
		isRemoteUser: jest.fn().mockReturnValue(false),
		pack: jest.fn().mockResolvedValue({ id: 'user2' }),
	} as unknown as jest.Mocked<UserEntityService>;

	const idService = {
		genId: jest.fn().mockReturnValue('blocking1'),
	} as unknown as IdService;

	const queueService = {
		deliver: jest.fn().mockReturnValue(null),
		webhookDeliver: jest.fn(),
	} as unknown as QueueService;

	const globalEventService = {
		publishInternalEvent: jest.fn(),
		publishMainStream: jest.fn(),
	} as unknown as GlobalEventService;

	const webhookService = {
		getActiveWebhooks: jest.fn().mockResolvedValue([]),
	} as unknown as WebhookService;

	const apRendererService = {
		renderBlock: jest.fn().mockReturnValue({ type: 'Block' }),
		renderUndo: jest.fn().mockReturnValue({ type: 'Undo' }),
		renderFollow: jest.fn().mockReturnValue({ type: 'Follow' }),
		renderReject: jest.fn().mockReturnValue({ type: 'Reject' }),
		addContext: jest.fn().mockImplementation(x => x),
	} as unknown as ApRendererService;

	const loggerService = {
		getLogger: jest.fn().mockReturnValue({ warn: jest.fn() }),
	} as unknown as LoggerService;

	const service = new UserBlockingService(
		moduleRef,
		followRequestsRepository,
		blockingsRepository,
		userListsRepository,
		userListJoiningsRepository,
		cacheService,
		userEntityService,
		idService,
		queueService,
		globalEventService,
		webhookService,
		apRendererService,
		loggerService,
	);

	service.onModuleInit();

	return {
		service,
		mocks: {
			moduleRef,
			followRequestsRepository,
			blockingsRepository,
			userListsRepository,
			userListJoiningsRepository,
			cacheService,
			userEntityService,
			idService,
			queueService,
			globalEventService,
			webhookService,
			apRendererService,
			loggerService,
		},
	};
}

describe('UserBlockingService', () => {
	test('block inserts blocking and refreshes caches', async () => {
		const { service, mocks } = createService();
		const blocker = createUser({ id: 'blocker' });
		const blockee = createUser({ id: 'blockee' });

		await service.block(blocker, blockee);

		expect(mocks.blockingsRepository.insert).toHaveBeenCalled();
		expect(mocks.cacheService.userBlockingCache.refresh).toHaveBeenCalledWith('blocker');
		expect(mocks.cacheService.userBlockedCache.refresh).toHaveBeenCalledWith('blockee');
		expect(mocks.globalEventService.publishInternalEvent).toHaveBeenCalledWith('blockingCreated', { blockerId: 'blocker', blockeeId: 'blockee' });
	});

	test('block delivers ActivityPub Block to remote user', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		const blocker = createUser({ id: 'blocker', host: null });
		const blockee = createUser({ id: 'blockee', host: 'remote.example', inbox: 'https://remote.example/inbox' });

		await service.block(blocker, blockee);

		expect(mocks.queueService.deliver).toHaveBeenCalledWith(blocker, expect.objectContaining({ type: 'Block' }), 'https://remote.example/inbox', false);
	});

	test('unblock deletes blocking and refreshes caches', async () => {
		const { service, mocks } = createService();
		mocks.blockingsRepository.findOneBy.mockResolvedValue({ id: 'blocking1' } as any);
		const blocker = createUser({ id: 'blocker' });
		const blockee = createUser({ id: 'blockee' });

		await service.unblock(blocker, blockee);

		expect(mocks.blockingsRepository.delete).toHaveBeenCalledWith('blocking1');
		expect(mocks.globalEventService.publishInternalEvent).toHaveBeenCalledWith('blockingDeleted', { blockerId: 'blocker', blockeeId: 'blockee' });
	});

	test('unblock warns when no blocking exists', async () => {
		const { service, mocks } = createService();
		mocks.blockingsRepository.findOneBy.mockResolvedValue(null);
		const blocker = createUser({ id: 'blocker' });
		const blockee = createUser({ id: 'blockee' });

		await service.unblock(blocker, blockee);

		expect(mocks.loggerService.getLogger('user-block').warn).toHaveBeenCalled();
		expect(mocks.blockingsRepository.delete).not.toHaveBeenCalled();
	});

	test('unblock delivers Undo Block to remote user', async () => {
		const { service, mocks } = createService();
		mocks.blockingsRepository.findOneBy.mockResolvedValue({ id: 'blocking1' } as any);
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		const blocker = createUser({ id: 'blocker', host: null });
		const blockee = createUser({ id: 'blockee', host: 'remote.example', inbox: 'https://remote.example/inbox' });

		await service.unblock(blocker, blockee);

		expect(mocks.queueService.deliver).toHaveBeenCalledWith(blocker, expect.objectContaining({ type: 'Undo' }), 'https://remote.example/inbox', false);
	});

	test('cancelRequest sends webhook for local follower when not silent', async () => {
		const { service, mocks } = createService();
		mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1', requestId: 'reqid' } as any);
		mocks.webhookService.getActiveWebhooks.mockResolvedValue([{ userId: 'follower', on: ['unfollow'], url: 'https://example.com/hook', secret: 's', id: 'wh1' }] as any);
		const follower = createUser({ id: 'follower', host: null });
		const followee = createUser({ id: 'followee', host: null });

		await (service as any).cancelRequest(follower, followee, false);
		await new Promise(resolve => setImmediate(resolve));

		expect(mocks.queueService.webhookDeliver).toHaveBeenCalled();
	});

	test('cancelRequest delivers UndoFollow when local follower and remote followee', async () => {
		const { service, mocks } = createService();
		mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1', requestId: 'reqid' } as any);
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		const follower = createUser({ id: 'follower', host: null });
		const followee = createUser({ id: 'followee', host: 'remote.example', inbox: 'https://remote.example/inbox' });

		await (service as any).cancelRequest(follower, followee, true);

		expect(mocks.queueService.deliver).toHaveBeenCalledWith(follower, expect.objectContaining({ type: 'Undo' }), 'https://remote.example/inbox', false);
	});

	test('cancelRequest delivers Reject when remote follower and local followee', async () => {
		const { service, mocks } = createService();
		mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1', requestId: 'reqid' } as any);
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		const follower = createUser({ id: 'follower', host: 'remote.example', inbox: 'https://remote.example/inbox' });
		const followee = createUser({ id: 'followee', host: null });

		await (service as any).cancelRequest(follower, followee, true);

		expect(mocks.queueService.deliver).toHaveBeenCalledWith(followee, expect.objectContaining({ type: 'Reject' }), 'https://remote.example/inbox', false);
	});

	test('removeFromList deletes joinings for each user list', async () => {
		const { service, mocks } = createService();
		mocks.userListsRepository.findBy.mockResolvedValue([{ id: 'list1' }, { id: 'list2' }] as any);
		const listOwner = createUser({ id: 'owner' });
		const user = createUser({ id: 'target' });

		await (service as any).removeFromList(listOwner, user);

		expect(mocks.userListJoiningsRepository.delete).toHaveBeenCalledTimes(2);
	});

	test('checkBlocked returns true when blockee in cache set', async () => {
		const { service, mocks } = createService();
		mocks.cacheService.userBlockingCache.fetch.mockResolvedValue(new Set(['blockee']));

		const result = await service.checkBlocked('blocker', 'blockee');

		expect(result).toBe(true);
	});

	test('checkBlocked returns false when blockee not in cache set', async () => {
		const { service, mocks } = createService();
		mocks.cacheService.userBlockingCache.fetch.mockResolvedValue(new Set(['other']));

		const result = await service.checkBlocked('blocker', 'blockee');

		expect(result).toBe(false);
	});

	test('cancelRequest notifies local followee', async () => {
		const { service, mocks } = createService();
		mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1' } as any);
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		const follower = createUser({ id: 'follower', host: 'remote.example' });
		const followee = createUser({ id: 'followee', host: null });

		await (service as any).cancelRequest(follower, followee, true);
		await new Promise(resolve => setImmediate(resolve));

		expect(mocks.globalEventService.publishMainStream).toHaveBeenCalledWith('followee', 'meUpdated', expect.anything());
		expect(mocks.queueService.deliver).toHaveBeenCalledWith(followee, expect.objectContaining({ type: 'Reject' }), 'https://example.com/inbox', false);
	});

	test('cancelRequest triggers unfollow webhook for local follower', async () => {
		const { service, mocks } = createService();
		mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1' } as any);
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		mocks.webhookService.getActiveWebhooks.mockResolvedValue([{ userId: 'follower', on: ['unfollow'], url: 'https://example.com/hook', secret: 's', id: 'wh1' }] as any);
		const follower = createUser({ id: 'follower', host: null });
		const followee = createUser({ id: 'followee', host: null });

		await (service as any).cancelRequest(follower, followee, false);
		await new Promise(resolve => setImmediate(resolve));

		expect(mocks.globalEventService.publishMainStream).toHaveBeenCalledWith('follower', 'unfollow', expect.anything());
		expect(mocks.queueService.webhookDeliver).toHaveBeenCalled();
	});

	test('cancelRequest does nothing when no request exists', async () => {
		const { service, mocks } = createService();
		mocks.followRequestsRepository.findOneBy.mockResolvedValue(null);
		const follower = createUser({ id: 'follower' });
		const followee = createUser({ id: 'followee' });

		await (service as any).cancelRequest(follower, followee, false);

		expect(mocks.followRequestsRepository.delete).not.toHaveBeenCalled();
		expect(mocks.globalEventService.publishMainStream).not.toHaveBeenCalled();
	});

	test('block skips ActivityPub delivery when blocker is remote', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		const blocker = createUser({ id: 'blocker', host: 'remote.example' });
		const blockee = createUser({ id: 'blockee', host: 'remote.example', inbox: 'https://remote.example/inbox' });

		await service.block(blocker, blockee);

		expect(mocks.queueService.deliver).not.toHaveBeenCalled();
	});

	test('block skips ActivityPub delivery when blockee is local', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		const blocker = createUser({ id: 'blocker', host: null });
		const blockee = createUser({ id: 'blockee', host: null });

		await service.block(blocker, blockee);

		expect(mocks.queueService.deliver).not.toHaveBeenCalled();
	});

	test('unblock skips ActivityPub delivery when blocker is remote', async () => {
		const { service, mocks } = createService();
		mocks.blockingsRepository.findOneBy.mockResolvedValue({ id: 'blocking1' } as any);
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		const blocker = createUser({ id: 'blocker', host: 'remote.example' });
		const blockee = createUser({ id: 'blockee', host: 'remote.example', inbox: 'https://remote.example/inbox' });

		await service.unblock(blocker, blockee);

		expect(mocks.queueService.deliver).not.toHaveBeenCalled();
	});

	test('unblock skips ActivityPub delivery when both users are local', async () => {
		const { service, mocks } = createService();
		mocks.blockingsRepository.findOneBy.mockResolvedValue({ id: 'blocking1' } as any);
		const blocker = createUser({ id: 'blocker', host: null });
		const blockee = createUser({ id: 'blockee', host: null });

		await service.unblock(blocker, blockee);

		expect(mocks.queueService.deliver).not.toHaveBeenCalled();
		expect(mocks.blockingsRepository.delete).toHaveBeenCalledWith('blocking1');
	});

	test('cancelRequest deletes request but takes no local action for remote pair', async () => {
		const { service, mocks } = createService();
		mocks.followRequestsRepository.findOneBy.mockResolvedValue({ id: 'req1', requestId: 'reqid' } as any);
		mocks.userEntityService.isLocalUser.mockImplementation(user => (user as User).host === null);
		mocks.userEntityService.isRemoteUser.mockImplementation(user => (user as User).host !== null);
		const follower = createUser({ id: 'follower', host: 'remote.example', inbox: 'https://remote.example/inbox' });
		const followee = createUser({ id: 'followee', host: 'remote.example', inbox: 'https://remote2.example/inbox' });

		await (service as any).cancelRequest(follower, followee, false);

		expect(mocks.followRequestsRepository.delete).toHaveBeenCalled();
		expect(mocks.globalEventService.publishMainStream).not.toHaveBeenCalled();
		expect(mocks.queueService.deliver).not.toHaveBeenCalled();
	});
});
