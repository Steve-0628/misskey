process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { AccountMoveService } from '@/core/AccountMoveService.js';
import type { Config } from '@/config.js';
import type { BlockingsRepository, FollowingsRepository, InstancesRepository, MutingsRepository, UserListJoiningsRepository, UsersRepository } from '@/models/index.js';
import type { IdService } from '@/core/IdService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { QueueService } from '@/core/QueueService.js';
import type { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import type { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import type { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { CacheService } from '@/core/CacheService.js';
import type { ProxyAccountService } from '@/core/ProxyAccountService.js';
import type { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import type { MetaService } from '@/core/MetaService.js';
import type InstanceChart from '@/core/chart/charts/instance.js';
import type PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import type { LocalUser, RemoteUser, User } from '@/models/entities/User.js';

function createLocalUser(id: string, data: Partial<LocalUser> = {}): LocalUser {
	return {
		id,
		host: null,
		username: `user${id}`,
		usernameLower: `user${id}`,
		alsoKnownAs: null,
		movedToUri: null,
		movedAt: null,
		...data,
	} as unknown as LocalUser;
}

function createRemoteUser(id: string, host: string, data: Partial<RemoteUser> = {}): RemoteUser {
	return {
		id,
		host,
		username: `user${id}`,
		usernameLower: `user${id}`,
		uri: `https://${host}/users/${id}`,
		alsoKnownAs: null,
		movedToUri: null,
		lastFetchedAt: new Date(),
		...data,
	} as unknown as RemoteUser;
}

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const usersRepository = {
		update: jest.fn().mockResolvedValue(undefined),
		decrement: jest.fn().mockResolvedValue(undefined),
		findBy: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<UsersRepository>;

	const followingsRepository = {
		findBy: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<FollowingsRepository>;

	const blockingsRepository = {
		findBy: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<BlockingsRepository>;

	const mutingsRepository = {
		findBy: jest.fn().mockResolvedValue([]),
		insert: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<MutingsRepository>;

	const userListJoiningsRepository = {
		find: jest.fn().mockResolvedValue([]),
		insert: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<UserListJoiningsRepository>;

	const instancesRepository = {
		decrement: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<InstancesRepository>;

	const userEntityService = {
		getUserUri: jest.fn().mockImplementation((user: User) => user.host ? `https://${user.host}/users/${user.id}` : `https://example.com/users/${user.id}`),
		isRemoteUser: jest.fn().mockImplementation((user: User) => user.host !== null),
		isLocalUser: jest.fn().mockImplementation((user: User) => user.host === null),
		pack: jest.fn().mockResolvedValue({ id: 'user1' }),
	} as unknown as jest.Mocked<UserEntityService>;

	const idService = {
		genId: jest.fn().mockReturnValue('id1'),
	} as unknown as IdService;

	const apPersonService = {
		fetchPerson: jest.fn().mockResolvedValue(null),
		updatePerson: jest.fn().mockResolvedValue(undefined),
	} as unknown as ApPersonService;

	const apRendererService = {
		renderPerson: jest.fn().mockResolvedValue({ type: 'Person' }),
		renderUpdate: jest.fn().mockReturnValue({ type: 'Update' }),
		renderMove: jest.fn().mockReturnValue({ type: 'Move' }),
		addContext: jest.fn().mockImplementation(x => x),
	} as unknown as ApRendererService;

	const apDeliverManagerService = {
		deliverToFollowers: jest.fn().mockResolvedValue(undefined),
	} as unknown as ApDeliverManagerService;

	const globalEventService = {
		publishMainStream: jest.fn(),
	} as unknown as GlobalEventService;

	const proxyAccountService = {
		fetch: jest.fn().mockResolvedValue(null),
	} as unknown as ProxyAccountService;

	const perUserFollowingChart = {
		update: jest.fn(),
	} as unknown as PerUserFollowingChart;

	const federatedInstanceService = {
		fetch: jest.fn().mockResolvedValue({ id: 'instance1', host: 'remote.example' }),
	} as unknown as FederatedInstanceService;

	const instanceChart = {
		updateFollowers: jest.fn(),
	} as unknown as InstanceChart;

	const metaService = {
		fetch: jest.fn().mockResolvedValue({ enableChartsForFederatedInstances: false }),
	} as unknown as MetaService;

	const cacheService = {
		uriPersonCache: {
			set: jest.fn(),
		},
	} as unknown as CacheService;

	const queueService = {
		createDelayedUnfollowJob: jest.fn(),
		createFollowJob: jest.fn(),
		createBlockJob: jest.fn(),
	} as unknown as QueueService;

	const service = new AccountMoveService(
		config,
		usersRepository,
		followingsRepository,
		blockingsRepository,
		mutingsRepository,
		userListJoiningsRepository,
		instancesRepository,
		userEntityService,
		idService,
		apPersonService,
		apRendererService,
		apDeliverManagerService,
		globalEventService,
		proxyAccountService,
		perUserFollowingChart,
		federatedInstanceService,
		instanceChart,
		metaService,
		cacheService,
		queueService,
	);

	return {
		service,
		mocks: {
			usersRepository,
			followingsRepository,
			blockingsRepository,
			mutingsRepository,
			userListJoiningsRepository,
			instancesRepository,
			userEntityService,
			idService,
			apPersonService,
			apRendererService,
			apDeliverManagerService,
			globalEventService,
			proxyAccountService,
			perUserFollowingChart,
			federatedInstanceService,
			instanceChart,
			metaService,
			cacheService,
			queueService,
		},
	};
}

describe('AccountMoveService', () => {
	test('moveFromLocal updates source user and delivers activities', async () => {
		const { service, mocks } = createService();
		const src = createLocalUser('src');
		const dst = createRemoteUser('dst', 'remote.example');

		await service.moveFromLocal(src, dst);

		expect(mocks.usersRepository.update).toHaveBeenCalledWith('src', expect.objectContaining({ movedToUri: 'https://remote.example/users/dst' }));
		expect(mocks.apDeliverManagerService.deliverToFollowers).toHaveBeenCalledTimes(2);
		expect(mocks.queueService.createDelayedUnfollowJob).toHaveBeenCalled();
		expect(mocks.queueService.createFollowJob).toHaveBeenCalled();
	});

	test('moveFromLocal appends alsoKnownAs if not present', async () => {
		const { service, mocks } = createService();
		const src = createLocalUser('src');
		const dst = createRemoteUser('dst', 'remote.example');

		await service.moveFromLocal(src, dst);

		expect(mocks.usersRepository.update).toHaveBeenCalledWith('src', expect.objectContaining({
			alsoKnownAs: ['https://remote.example/users/dst'],
		}));
	});

	test('postMoveProcess copies blocking, mutings, and lists', async () => {
		const { service, mocks } = createService();
		mocks.blockingsRepository.findBy.mockResolvedValue([{ blockerId: 'user1', blockeeId: 'src' }] as any);
		mocks.mutingsRepository.findBy.mockResolvedValueOnce([{ muterId: 'user1', muteeId: 'src', expiresAt: null }] as any);
		mocks.mutingsRepository.findBy.mockResolvedValueOnce([]);
		mocks.userListJoiningsRepository.find.mockResolvedValue([{ userId: 'src', userListId: 'list1' }]);
		const src = createLocalUser('src');
		const dst = createRemoteUser('dst', 'remote.example');

		await service.postMoveProcess(src, dst);

		expect(mocks.queueService.createBlockJob).toHaveBeenCalled();
		expect(mocks.mutingsRepository.insert).toHaveBeenCalled();
		expect(mocks.userListJoiningsRepository.insert).toHaveBeenCalled();
	});

	test('copyBlocking skips already blocked users', async () => {
		const { service, mocks } = createService();
		mocks.blockingsRepository.findBy.mockImplementation(({ blockeeId }: any) =>
			Promise.resolve(blockeeId === 'src' ? [{ blockerId: 'user1', blockeeId: 'src' }] : [{ blockerId: 'user1', blockeeId: 'dst' }])
		);
		const src = { id: 'src' } as any;
		const dst = { id: 'dst' } as any;

		await service.copyBlocking(src, dst);

		expect(mocks.queueService.createBlockJob).toHaveBeenCalledWith([]);
	});

	test('copyMutings skips existing indefinite mutings', async () => {
		const { service, mocks } = createService();
		mocks.mutingsRepository.findBy.mockResolvedValueOnce([{ muterId: 'user1', muteeId: 'src', expiresAt: null }] as any);
		mocks.mutingsRepository.findBy.mockResolvedValueOnce([{ muterId: 'user1', muteeId: 'dst', expiresAt: null }] as any);
		const src = { id: 'src' } as any;
		const dst = { id: 'dst' } as any;

		await service.copyMutings(src, dst);

		expect(mocks.mutingsRepository.insert).toHaveBeenCalledWith([]);
	});

	test('copyMutings inserts new mutings when none existing', async () => {
		const { service, mocks } = createService();
		mocks.mutingsRepository.findBy.mockResolvedValueOnce([{ muterId: 'user1', muteeId: 'src', expiresAt: null }] as any);
		mocks.mutingsRepository.findBy.mockResolvedValueOnce([]);
		mocks.idService.genId.mockReturnValue('newMuteId');
		const src = { id: 'src' } as any;
		const dst = { id: 'dst' } as any;

		await service.copyMutings(src, dst);

		expect(mocks.mutingsRepository.insert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ muterId: 'user1', muteeId: 'dst' })]));
	});

	test('updateLists skips existing list entries', async () => {
		const { service, mocks } = createService();
		mocks.userListJoiningsRepository.find.mockResolvedValueOnce([{ userId: 'src', userListId: 'list1' }]);
		mocks.userListJoiningsRepository.find.mockResolvedValueOnce([{ userId: 'dst', userListId: 'list1' }]);
		const src = { id: 'src' } as any;
		const dst = { id: 'dst', host: null } as any;

		await service.updateLists(src, dst);

		expect(mocks.userListJoiningsRepository.insert).toHaveBeenCalledWith([]);
	});

	test('updateLists creates follow job for remote dst via proxy', async () => {
		const { service, mocks } = createService();
		mocks.userListJoiningsRepository.find.mockResolvedValue([{ userId: 'src', userListId: 'list1' }]);
		mocks.proxyAccountService.fetch.mockResolvedValue({ id: 'proxy1' });
		const src = { id: 'src' } as any;
		const dst = { id: 'dst', host: 'remote.example' } as any;

		await service.updateLists(src, dst);

		expect(mocks.queueService.createFollowJob).toHaveBeenCalledWith([{ from: { id: 'proxy1' }, to: { id: 'dst' } }]);
	});

	test('adjustFollowingCounts handles remote old account', async () => {
		const { service, mocks } = createService();
		mocks.followingsRepository.findBy.mockResolvedValue([{ followeeId: 'user2' }] as any);
		mocks.metaService.fetch.mockResolvedValue({ enableChartsForFederatedInstances: true });
		mocks.federatedInstanceService.fetch.mockResolvedValue({ id: 'instance1', host: 'remote.example' });
		const src = createRemoteUser('src', 'remote.example');

		await (service as any).adjustFollowingCounts(['user1'], src);
		await new Promise(resolve => setImmediate(resolve));

		expect(mocks.instancesRepository.decrement).toHaveBeenCalled();
		expect(mocks.instanceChart.updateFollowers).toHaveBeenCalled();
	});

	test('validateAlsoKnownAs returns null when no alsoKnownAs', async () => {
		const { service } = createService();
		const dst = createLocalUser('dst');

		const result = await service.validateAlsoKnownAs(dst);

		expect(result).toBeNull();
	});

	test('validateAlsoKnownAs finds matching moved user', async () => {
		const { service, mocks } = createService();
		const src = createLocalUser('src');
		(src as any).movedToUri = 'https://example.com/users/dst';
		mocks.apPersonService.fetchPerson.mockResolvedValue(src);
		const dst = createLocalUser('dst', { alsoKnownAs: ['https://example.com/users/src'] });

		const result = await service.validateAlsoKnownAs(dst);

		expect(result).not.toBeNull();
		expect(result!.id).toBe('src');
	});

	test('validateAlsoKnownAs instant return returns first match', async () => {
		const { service, mocks } = createService();
		const src = createLocalUser('src');
		(src as any).movedToUri = 'https://example.com/users/dst';
		mocks.apPersonService.fetchPerson.mockResolvedValue(src);
		const dst = createLocalUser('dst', { alsoKnownAs: ['https://example.com/users/src'] });

		const result = await service.validateAlsoKnownAs(dst, undefined, true);

		expect(result!.id).toBe('src');
	});

	test('validateAlsoKnownAs updates remote person when stale', async () => {
		const { service, mocks } = createService();
		const dst = createRemoteUser('dst', 'remote.example', { alsoKnownAs: ['https://remote.example/users/src'], lastFetchedAt: new Date(0) });
		const src = createRemoteUser('src', 'remote.example', { movedToUri: 'https://remote.example/users/dst' });
		mocks.apPersonService.fetchPerson.mockResolvedValue(src);

		await service.validateAlsoKnownAs(dst);

		expect(mocks.apPersonService.updatePerson).toHaveBeenCalled();
	});

	test('moveFromLocal keeps existing alsoKnownAs', async () => {
		const { service, mocks } = createService();
		const src = createLocalUser('src', { alsoKnownAs: ['https://remote.example/users/dst', 'https://other.example/users/x'] });
		const dst = createRemoteUser('dst', 'remote.example');

		await service.moveFromLocal(src, dst);

		expect(mocks.usersRepository.update).toHaveBeenCalledWith('src', expect.objectContaining({
			alsoKnownAs: ['https://remote.example/users/dst', 'https://other.example/users/x'],
		}));
	});

	test('updateLists does nothing when no old joinings', async () => {
		const { service, mocks } = createService();
		mocks.userListJoiningsRepository.find.mockResolvedValue([]);
		const src = { id: 'src' } as any;
		const dst = { id: 'dst' } as any;

		await service.updateLists(src, dst);

		expect(mocks.userListJoiningsRepository.insert).not.toHaveBeenCalled();
	});

	test('updateLists does not create proxy follow for local dst', async () => {
		const { service, mocks } = createService();
		mocks.userListJoiningsRepository.find.mockResolvedValue([{ userId: 'src', userListId: 'list1' }]);
		const src = { id: 'src' } as any;
		const dst = { id: 'dst', host: null } as any;

		await service.updateLists(src, dst);

		expect(mocks.queueService.createFollowJob).not.toHaveBeenCalled();
	});

	test('updateLists inserts new joinings for local dst', async () => {
		const { service, mocks } = createService();
		mocks.userListJoiningsRepository.find.mockResolvedValueOnce([{ userId: 'src', userListId: 'list1' }]);
		mocks.userListJoiningsRepository.find.mockResolvedValueOnce([]);
		mocks.idService.genId.mockReturnValue('newJoinId');
		const src = { id: 'src' } as any;
		const dst = { id: 'dst', host: null } as any;

		await service.updateLists(src, dst);

		expect(mocks.userListJoiningsRepository.insert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ userId: 'dst', userListId: 'list1' })]));
	});

	test('copyBlocking does nothing when src has no blockings', async () => {
		const { service, mocks } = createService();
		mocks.blockingsRepository.findBy.mockResolvedValue([]);
		const src = { id: 'src' } as any;
		const dst = { id: 'dst' } as any;

		await service.copyBlocking(src, dst);

		expect(mocks.queueService.createBlockJob).toHaveBeenCalledWith([]);
	});

	test('copyMutings does nothing when src has no mutings', async () => {
		const { service, mocks } = createService();
		mocks.mutingsRepository.findBy.mockResolvedValue([]);
		const src = { id: 'src' } as any;
		const dst = { id: 'dst' } as any;

		await service.copyMutings(src, dst);

		expect(mocks.mutingsRepository.insert).not.toHaveBeenCalled();
	});

	test('adjustFollowingCounts does nothing when no local followers', async () => {
		const { service, mocks } = createService();

		await (service as any).adjustFollowingCounts([], createLocalUser('src'));

		expect(mocks.usersRepository.update).not.toHaveBeenCalled();
	});

	test('adjustFollowingCounts decrements followees for local old account', async () => {
		const { service, mocks } = createService();
		mocks.followingsRepository.findBy.mockResolvedValue([{ followeeId: 'user2' }] as any);
		const src = createLocalUser('src');

		await (service as any).adjustFollowingCounts(['user1'], src);

		expect(mocks.usersRepository.decrement).toHaveBeenCalled();
		expect(mocks.federatedInstanceService.fetch).not.toHaveBeenCalled();
	});

	test('adjustFollowingCounts skips instance update for local old account', async () => {
		const { service, mocks } = createService();
		mocks.followingsRepository.findBy.mockResolvedValue([]);

		await (service as any).adjustFollowingCounts(['user1'], createLocalUser('src'));
		await new Promise(resolve => setImmediate(resolve));

		expect(mocks.usersRepository.update).toHaveBeenCalled();
		expect(mocks.federatedInstanceService.fetch).not.toHaveBeenCalled();
	});

	test('validateAlsoKnownAs skips src with mismatched movedToUri', async () => {
		const { service, mocks } = createService();
		const src = createLocalUser('src', { movedToUri: 'https://example.com/users/other' });
		mocks.apPersonService.fetchPerson.mockResolvedValue(src);
		const dst = createLocalUser('dst', { alsoKnownAs: ['https://example.com/users/src'] });

		const result = await service.validateAlsoKnownAs(dst);

		expect(result).toBeNull();
	});

	test('validateAlsoKnownAs skips src when check returns false', async () => {
		const { service, mocks } = createService();
		const src = createLocalUser('src', { movedToUri: 'https://example.com/users/dst' });
		mocks.apPersonService.fetchPerson.mockResolvedValue(src);
		const dst = createLocalUser('dst', { alsoKnownAs: ['https://example.com/users/src'] });

		const result = await service.validateAlsoKnownAs(dst, () => false);

		expect(result).toBeNull();
	});

	test('validateAlsoKnownAs handles remote dst without stale fetch', async () => {
		const { service, mocks } = createService();
		const dst = createRemoteUser('dst', 'remote.example', { alsoKnownAs: ['https://remote.example/users/src'], lastFetchedAt: new Date() });
		const src = createRemoteUser('src', 'remote.example', { movedToUri: 'https://remote.example/users/dst' });
		mocks.apPersonService.fetchPerson.mockResolvedValue(src);

		await service.validateAlsoKnownAs(dst);

		expect(mocks.apPersonService.updatePerson).not.toHaveBeenCalled();
	});

	test('validateAlsoKnownAs skips src that cannot be fetched', async () => {
		const { service, mocks } = createService();
		mocks.apPersonService.fetchPerson.mockResolvedValue(null);
		const dst = createLocalUser('dst', { alsoKnownAs: ['https://example.com/users/src'] });

		const result = await service.validateAlsoKnownAs(dst);

		expect(result).toBeNull();
	});

	test('postMoveProcess uses proxy account when present', async () => {
		const { service, mocks } = createService();
		mocks.proxyAccountService.fetch.mockResolvedValue({ id: 'proxy1' });
		mocks.followingsRepository.findBy.mockResolvedValue([{ followerId: 'user1' }] as any);
		const src = createLocalUser('src');
		const dst = createRemoteUser('dst', 'remote.example');

		await service.postMoveProcess(src, dst);

		expect(mocks.followingsRepository.findBy).toHaveBeenCalledWith(expect.objectContaining({ followerId: expect.any(Object) }));
		expect(mocks.queueService.createFollowJob).toHaveBeenCalledWith([{ from: { id: 'user1' }, to: { id: 'dst' } }]);
	});
});
