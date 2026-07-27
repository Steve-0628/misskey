process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import type { Config } from '@/config.js';
import type { FollowingsRepository, UsersRepository } from '@/models/index.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { QueueService } from '@/core/QueueService.js';
import type { IActivity } from '@/core/activitypub/type.js';
import type { RemoteUser } from '@/models/entities/User.js';

function createService() {
	const config = { url: 'https://example.com' } as Config;

	const followingsRepository = {
		find: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<FollowingsRepository>;

	const usersRepository = {} as unknown as UsersRepository;

	const userEntityService = {} as unknown as UserEntityService;

	const queueService = {
		deliver: jest.fn(),
	} as unknown as jest.Mocked<QueueService>;

	const service = new ApDeliverManagerService(
		config,
		usersRepository,
		followingsRepository,
		userEntityService,
		queueService,
	);

	return {
		service,
		mocks: {
			followingsRepository,
			queueService,
		},
	};
}

describe('ApDeliverManagerService', () => {
	test('deliverToFollowers delivers to follower inboxes', async () => {
		const { service, mocks } = createService();
		mocks.followingsRepository.find.mockResolvedValue([
			{ followerSharedInbox: 'https://remote.example/inbox', followerInbox: 'https://remote.example/inbox' },
			{ followerSharedInbox: null, followerInbox: 'https://other.example/inbox' },
		] as any);

		await service.deliverToFollowers({ id: 'user1', host: null }, { type: 'Create' } as IActivity);

		expect(mocks.queueService.deliver).toHaveBeenCalledTimes(2);
		expect(mocks.queueService.deliver).toHaveBeenCalledWith({ id: 'user1' }, expect.anything(), 'https://remote.example/inbox', true);
		expect(mocks.queueService.deliver).toHaveBeenCalledWith({ id: 'user1' }, expect.anything(), 'https://other.example/inbox', false);
	});

	test('deliverToUser delivers to remote user inbox', async () => {
		const { service, mocks } = createService();

		await service.deliverToUser(
			{ id: 'user1', host: null },
			{ type: 'Create' } as IActivity,
			{ id: 'remote1', host: 'remote.example', inbox: 'https://remote.example/inbox', sharedInbox: null } as unknown as RemoteUser,
		);

		expect(mocks.queueService.deliver).toHaveBeenCalledWith({ id: 'user1' }, expect.anything(), 'https://remote.example/inbox', false);
	});

	test('createDeliverManager throws when actor host is not null', async () => {
		const { service } = createService();

		expect(() => service.createDeliverManager({ id: 'user1', host: 'remote.example' as any }, { type: 'Create' } as IActivity)).toThrow('actor.host must be null');
	});

	test('execute skips direct recipe when shared inbox already added', async () => {
		const { service, mocks } = createService();
		mocks.followingsRepository.find.mockResolvedValue([
			{ followerSharedInbox: 'https://shared.example/inbox', followerInbox: 'https://remote.example/inbox' },
		] as any);

		const manager = service.createDeliverManager({ id: 'user1', host: null }, { type: 'Create' } as IActivity);
		manager.addFollowersRecipe();
		manager.addDirectRecipe({ id: 'remote1', host: 'remote.example', inbox: 'https://remote.example/inbox', sharedInbox: 'https://shared.example/inbox' } as unknown as RemoteUser);
		await manager.execute();

		expect(mocks.queueService.deliver).toHaveBeenCalledTimes(1);
		expect(mocks.queueService.deliver).toHaveBeenCalledWith({ id: 'user1' }, expect.anything(), 'https://shared.example/inbox', true);
	});

	test('execute skips direct recipe when inbox is null', async () => {
		const { service, mocks } = createService();

		const manager = service.createDeliverManager({ id: 'user1', host: null }, { type: 'Create' } as IActivity);
		manager.addDirectRecipe({ id: 'remote1', host: 'remote.example', inbox: null, sharedInbox: null } as unknown as RemoteUser);
		await manager.execute();

		expect(mocks.queueService.deliver).not.toHaveBeenCalled();
	});

	test('execute delivers nothing when no recipes', async () => {
		const { service, mocks } = createService();

		const manager = service.createDeliverManager({ id: 'user1', host: null }, { type: 'Create' } as IActivity);
		await manager.execute();

		expect(mocks.queueService.deliver).not.toHaveBeenCalled();
		expect(mocks.followingsRepository.find).not.toHaveBeenCalled();
	});
});
