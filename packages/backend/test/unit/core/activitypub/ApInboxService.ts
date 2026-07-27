process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { ApInboxService } from '@/core/activitypub/ApInboxService.js';
import type { Config } from '@/config.js';
import type { UsersRepository, NotesRepository, FollowingsRepository, AbuseUserReportsRepository, FollowRequestsRepository } from '@/models/index.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { UtilityService } from '@/core/UtilityService.js';
import type { IdService } from '@/core/IdService.js';
import type { MetaService } from '@/core/MetaService.js';
import type { UserFollowingService } from '@/core/UserFollowingService.js';
import type { ApAudienceService } from '@/core/activitypub/ApAudienceService.js';
import type { ReactionService } from '@/core/ReactionService.js';
import type { NotePiningService } from '@/core/NotePiningService.js';
import type { UserBlockingService } from '@/core/UserBlockingService.js';
import type { NoteCreateService } from '@/core/NoteCreateService.js';
import type { NoteDeleteService } from '@/core/NoteDeleteService.js';
import type { AppLockService } from '@/core/AppLockService.js';
import type { ApResolverService, Resolver } from '@/core/activitypub/ApResolverService.js';
import type { ApDbResolverService } from '@/core/activitypub/ApDbResolverService.js';
import type { ApLoggerService } from '@/core/activitypub/ApLoggerService.js';
import type { ApNoteService } from '@/core/activitypub/models/ApNoteService.js';
import type { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import type { ApQuestionService } from '@/core/activitypub/models/ApQuestionService.js';
import type { AccountMoveService } from '@/core/AccountMoveService.js';
import type { CacheService } from '@/core/CacheService.js';
import type { QueueService } from '@/core/QueueService.js';
import type { RemoteUser } from '@/models/entities/User.js';
import type { IObject, ICreate, IDelete, IFollow, IAccept, IReject, IAdd, IRemove, IAnnounce, ILike, IUndo, IBlock, IFlag, IMove, IUpdate } from '@/core/activitypub/type.js';

function createRemoteUser(id: string, host: string): RemoteUser {
	return {
		id,
		host,
		uri: `https://${host}/users/${id}`,
		inbox: `https://${host}/inbox`,
		isSuspended: false,
	} as unknown as RemoteUser;
}

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const usersRepository = {
		findOneByOrFail: jest.fn().mockImplementation(({ id }: { id: string }) => ({ id })),
		findBy: jest.fn().mockResolvedValue([]),
		findOneBy: jest.fn().mockResolvedValue(null),
		update: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<UsersRepository>;

	const notesRepository = {} as unknown as jest.Mocked<NotesRepository>;
	const followingsRepository = {
		exist: jest.fn().mockResolvedValue(false),
	} as unknown as jest.Mocked<FollowingsRepository>;

	const abuseUserReportsRepository = {
		insert: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<AbuseUserReportsRepository>;

	const followRequestsRepository = {
		exist: jest.fn().mockResolvedValue(false),
	} as unknown as jest.Mocked<FollowRequestsRepository>;

	const userEntityService = {
		isLocalUser: jest.fn().mockImplementation((user: any) => user?.host === null),
		isRemoteUser: jest.fn().mockImplementation((user: any) => user?.host !== null),
	} as unknown as jest.Mocked<UserEntityService>;

	const noteEntityService = {
		isVisibleForMe: jest.fn().mockResolvedValue(true),
	} as unknown as NoteEntityService;

	const utilityService = {
		extractDbHost: jest.fn().mockImplementation((uri: string) => {
			try {
				return new URL(uri).host;
			} catch {
				return 'remote.example';
			}
		}),
		isBlockedHost: jest.fn().mockReturnValue(false),
	} as unknown as UtilityService;

	const idService = {
		genId: jest.fn().mockReturnValue('id1'),
	} as unknown as IdService;

	const metaService = {
		fetch: jest.fn().mockResolvedValue({ blockedHosts: [] }),
	} as unknown as MetaService;

	const userFollowingService = {
		follow: jest.fn().mockResolvedValue(undefined),
		acceptFollowRequest: jest.fn().mockResolvedValue(undefined),
		rejectFollowRequest: jest.fn().mockResolvedValue(undefined),
		unfollow: jest.fn().mockResolvedValue(undefined),
		remoteReject: jest.fn().mockResolvedValue(undefined),
	} as unknown as UserFollowingService;

	const apAudienceService = {
		parseAudience: jest.fn().mockResolvedValue({ visibility: 'public', visibleUsers: [] }),
	} as unknown as ApAudienceService;

	const reactionService = {
		create: jest.fn().mockResolvedValue(undefined),
	} as unknown as ReactionService;

	const notePiningService = {
		addPinned: jest.fn().mockResolvedValue(undefined),
	} as unknown as NotePiningService;

	const userBlockingService = {
		block: jest.fn().mockResolvedValue(undefined),
		unblock: jest.fn().mockResolvedValue(undefined),
	} as unknown as UserBlockingService;

	const noteCreateService = {
		create: jest.fn().mockResolvedValue(undefined),
	} as unknown as NoteCreateService;

	const noteDeleteService = {
		delete: jest.fn().mockResolvedValue(undefined),
	} as unknown as NoteDeleteService;

	const appLockService = {
		getApLock: jest.fn().mockResolvedValue(jest.fn()),
	} as unknown as AppLockService;

	const resolver = {
		resolve: jest.fn().mockResolvedValue({}),
	} as unknown as Resolver;

	const apResolverService = {
		createResolver: jest.fn().mockReturnValue(resolver),
	} as unknown as ApResolverService;

	const apDbResolverService = {
		getUserFromApId: jest.fn().mockResolvedValue(null),
		getNoteFromApId: jest.fn().mockResolvedValue(null),
	} as unknown as ApDbResolverService;

	const logger = {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	};

	const apLoggerService = {
		logger,
	} as unknown as ApLoggerService;

	const apNoteService = {
		fetchNote: jest.fn().mockResolvedValue(null),
		resolveNote: jest.fn().mockResolvedValue(null),
		createNote: jest.fn().mockResolvedValue(undefined),
		extractEmojis: jest.fn().mockResolvedValue(undefined),
	} as unknown as ApNoteService;

	const apPersonService = {
		updatePerson: jest.fn().mockResolvedValue(undefined),
	} as unknown as ApPersonService;

	const apQuestionService = {} as unknown as ApQuestionService;

	const accountMoveService = {
		moveFromRemote: jest.fn().mockResolvedValue(undefined),
	} as unknown as AccountMoveService;

	const cacheService = {
		uriPersonCache: {
			set: jest.fn(),
		},
	} as unknown as CacheService;

	const queueService = {
		createDeleteAccountJob: jest.fn().mockResolvedValue({ name: 'delete', id: 'job1' }),
	} as unknown as QueueService;

	const service = new ApInboxService(
		config,
		usersRepository,
		notesRepository,
		followingsRepository,
		abuseUserReportsRepository,
		followRequestsRepository,
		userEntityService,
		noteEntityService,
		utilityService,
		idService,
		metaService,
		userFollowingService,
		apAudienceService,
		reactionService,
		notePiningService,
		userBlockingService,
		noteCreateService,
		noteDeleteService,
		appLockService,
		apResolverService,
		apDbResolverService,
		apLoggerService,
		apNoteService,
		apPersonService,
		apQuestionService,
		accountMoveService,
		cacheService,
		queueService,
	);

	return {
		service,
		mocks: {
			usersRepository,
			abuseUserReportsRepository,
			followingsRepository,
			followRequestsRepository,
			userEntityService,
			resolver,
			apResolverService,
			apDbResolverService,
			apNoteService,
			apPersonService,
			userFollowingService,
			reactionService,
			noteCreateService,
			noteDeleteService,
			userBlockingService,
			notePiningService,
			queueService,
			accountMoveService,
			metaService,
			utilityService,
			logger,
		},
	};
}

describe('ApInboxService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('performActivity', () => {
		test('processes non-collection activity directly', async () => {
			const { service, mocks } = createService();
			mocks.apNoteService.fetchNote.mockResolvedValue({ id: 'note1' });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performActivity(actor, { type: 'Like', actor: actor.uri, object: 'https://remote.example/notes/1' } as ILike);
			expect(mocks.reactionService.create).toHaveBeenCalled();
		});

		test('processes OrderedCollection items', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockImplementation((x: any) => Promise.resolve(x));
			mocks.apNoteService.fetchNote.mockResolvedValue({ id: 'note1' });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performActivity(actor, {
				type: 'OrderedCollection',
				orderedItems: [
					{ type: 'Like', actor: actor.uri, object: 'https://remote.example/notes/1' },
					{ type: 'Like', actor: actor.uri, object: 'https://remote.example/notes/2' },
				],
			} as unknown as IObject);
			expect(mocks.reactionService.create).toHaveBeenCalledTimes(2);
		});

		test('processes Collection items', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockImplementation((x: any) => Promise.resolve(x));
			mocks.apNoteService.fetchNote.mockResolvedValue({ id: 'note1' });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performActivity(actor, {
				type: 'Collection',
				items: [
					{ type: 'Like', actor: actor.uri, object: 'https://remote.example/notes/1' },
				],
			} as unknown as IObject);
			expect(mocks.reactionService.create).toHaveBeenCalledTimes(1);
		});

		test('logs errors from individual collection items but continues', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockImplementation((x: any) => Promise.resolve(x));
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performActivity(actor, {
				type: 'OrderedCollection',
				orderedItems: [
					{ type: 'Create', actor: actor.uri, object: 'https://remote.example/notes/missing-id' },
				],
			} as unknown as IObject);
			expect(mocks.logger.error).toHaveBeenCalled();
		});

		test('updates remote actor when lastFetchedAt is old', async () => {
			const { service, mocks } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			actor.lastFetchedAt = new Date(0);
			await service.performActivity(actor, { type: 'Like', actor: actor.uri, object: 'https://remote.example/notes/1' } as ILike);
			await new Promise(resolve => setImmediate(resolve));
			expect(mocks.apPersonService.updatePerson).toHaveBeenCalledWith(actor.uri);
		});
	});

	describe('performOneActivity', () => {
		test('Create activity creates note', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({ type: 'Note', attributedTo: 'https://remote.example/users/actor', id: 'https://remote.example/notes/1' });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, { type: 'Create', id: 'https://remote.example/notes/create1', actor: actor.uri, object: 'https://remote.example/notes/1' } as ICreate);
			expect(mocks.apNoteService.createNote).toHaveBeenCalled();
		});

		test('Delete activity deletes note via Tombstone', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getNoteFromApId.mockResolvedValue({ id: 'note1', userId: 'actor' });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, {
				type: 'Delete',
				actor: actor.uri,
				object: { type: 'Tombstone', formerType: 'Note', id: 'https://remote.example/notes/1' },
			} as IDelete);
			expect(mocks.noteDeleteService.delete).toHaveBeenCalled();
		});

		test('Delete activity deletes actor when formerType is missing but uri matches actor', async () => {
			const { service, mocks } = createService();
			mocks.usersRepository.findOneBy.mockResolvedValue({ id: 'actor', isDeleted: false });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, {
				type: 'Delete',
				actor: actor.uri,
				object: actor.uri,
			} as unknown as IDelete);
			expect(mocks.queueService.createDeleteAccountJob).toHaveBeenCalled();
		});

		test('Update activity updates person', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({ type: 'Person', id: 'https://remote.example/users/actor', attributedTo: 'https://remote.example/users/actor' });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, { type: 'Update', actor: actor.uri, object: 'https://remote.example/users/actor' } as IUpdate);
			expect(mocks.apPersonService.updatePerson).toHaveBeenCalled();
		});

		test('Follow activity follows local user', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue({ id: 'local1', host: null });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, { type: 'Follow', actor: actor.uri, object: 'https://example.com/users/local1', id: 'req1' } as IFollow);
			expect(mocks.userFollowingService.follow).toHaveBeenCalled();
		});

		test('Accept activity accepts follow request', async () => {
			const { service, mocks } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			mocks.resolver.resolve.mockResolvedValue({ type: 'Follow', actor: 'https://example.com/users/local1', object: actor.uri, id: 'req1' });
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue({ id: 'local1', host: null });
			await service.performOneActivity(actor, { type: 'Accept', actor: actor.uri, object: 'https://example.com/users/local1' } as IAccept);
			expect(mocks.userFollowingService.acceptFollowRequest).toHaveBeenCalled();
		});

		test('Reject activity rejects follow request', async () => {
			const { service, mocks } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			mocks.resolver.resolve.mockResolvedValue({ type: 'Follow', actor: 'https://example.com/users/local1', object: actor.uri, id: 'req1' });
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue({ id: 'local1', host: null });
			await service.performOneActivity(actor, { type: 'Reject', actor: actor.uri, object: 'https://example.com/users/local1' } as IReject);
			expect(mocks.userFollowingService.remoteReject).toHaveBeenCalled();
		});

		test('Add activity pins note to featured', async () => {
			const { service, mocks } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			actor.featured = 'https://remote.example/users/actor/collections/featured';
			mocks.apNoteService.resolveNote.mockResolvedValue({ id: 'note1' });
			await service.performOneActivity(actor, {
				type: 'Add',
				actor: actor.uri,
				target: actor.featured,
				object: 'https://remote.example/notes/1',
			} as IAdd);
			expect(mocks.notePiningService.addPinned).toHaveBeenCalled();
		});

		test('Remove activity removes pinned note', async () => {
			const { service, mocks } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			actor.featured = 'https://remote.example/users/actor/collections/featured';
			mocks.apNoteService.resolveNote.mockResolvedValue({ id: 'note1' });
			await service.performOneActivity(actor, {
				type: 'Remove',
				actor: actor.uri,
				target: actor.featured,
				object: 'https://remote.example/notes/1',
			} as IRemove);
			expect(mocks.notePiningService.addPinned).not.toHaveBeenCalled();
		});

		test('Announce activity creates renote', async () => {
			const { service, mocks } = createService();
			mocks.apNoteService.resolveNote.mockResolvedValue({ id: 'target1' });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, {
				type: 'Announce',
				id: 'https://remote.example/notes/renote1',
				actor: actor.uri,
				object: 'https://remote.example/notes/target1',
			} as IAnnounce);
			await new Promise(resolve => setImmediate(resolve));
			expect(mocks.noteCreateService.create).toHaveBeenCalled();
		});

		test('Like activity creates reaction', async () => {
			const { service, mocks } = createService();
			mocks.apNoteService.fetchNote.mockResolvedValue({ id: 'note1' });
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, { type: 'Like', actor: actor.uri, object: 'https://remote.example/notes/1' } as ILike);
			expect(mocks.reactionService.create).toHaveBeenCalled();
		});

		test('Undo activity undoes follow', async () => {
			const { service, mocks } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			mocks.resolver.resolve.mockResolvedValue({ type: 'Follow', actor: actor.uri, object: 'https://example.com/users/local1', id: 'req1' });
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue({ id: 'local1', host: null });
			mocks.followingsRepository.exist.mockResolvedValue(true);
			await service.performOneActivity(actor, {
				type: 'Undo',
				actor: actor.uri,
				object: { type: 'Follow', actor: actor.uri, object: 'https://example.com/users/local1', id: 'req1' },
			} as IUndo);
			expect(mocks.userFollowingService.unfollow).toHaveBeenCalled();
		});

		test('Block activity blocks local user', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue({ id: 'local1', host: null });
			mocks.usersRepository.findOneByOrFail.mockImplementation(({ id }: { id: string }) => {
				if (id === 'actor') return createRemoteUser('actor', 'remote.example');
				return { id: 'local1', host: null };
			});
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, { type: 'Block', actor: actor.uri, object: 'https://example.com/users/local1' } as IBlock);
			expect(mocks.userBlockingService.block).toHaveBeenCalled();
		});

		test('Flag activity reports abuse', async () => {
			const { service, mocks } = createService();
			mocks.usersRepository.findBy.mockResolvedValue([{ id: 'local1', host: null }]);
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, { type: 'Flag', actor: actor.uri, object: ['https://example.com/users/local1'], content: 'spam' } as IFlag);
			expect(mocks.abuseUserReportsRepository.insert).toHaveBeenCalled();
		});

		test('Move activity updates remote person', async () => {
			const { service, mocks } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, { type: 'Move', actor: actor.uri, object: 'https://new.example/users/actor', target: 'https://new.example/users/actor' } as IMove);
			expect(mocks.apPersonService.updatePerson).toHaveBeenCalledWith(actor.uri);
		});

		test('suspended actor returns immediately', async () => {
			const { service, mocks } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			actor.isSuspended = true;
			await service.performOneActivity(actor, { type: 'Create', actor: actor.uri } as ICreate);
			expect(mocks.apNoteService.createNote).not.toHaveBeenCalled();
		});

		test('warns on unrecognized activity type', async () => {
			const { service, mocks } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			await service.performOneActivity(actor, { type: 'UnknownType' } as unknown as IObject);
			expect(mocks.logger.warn).toHaveBeenCalled();
		});
	});

	describe('early returns', () => {
		test('follow skips when followee not found', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue(null);
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).follow(actor, { type: 'Follow', object: 'https://example.com/users/ghost', id: 'req1' } as IFollow);
			expect(result).toContain('skip');
		});

		test('follow skips when followee is remote', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue({ id: 'remote1', host: 'remote.example' });
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).follow(actor, { type: 'Follow', object: 'https://remote.example/users/remote1', id: 'req1' } as IFollow);
			expect(result).toContain('skip');
		});

		test('like skips when target note not found', async () => {
			const { service, mocks } = createService();
			mocks.apNoteService.fetchNote.mockResolvedValue(null);
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).like(actor, { type: 'Like', actor: actor.uri, object: 'https://remote.example/notes/ghost' } as ILike);
			expect(result).toContain('skip');
		});

		test('like handles already reacted', async () => {
			const { service, mocks } = createService();
			mocks.apNoteService.fetchNote.mockResolvedValue({ id: 'note1' });
			mocks.reactionService.create.mockRejectedValue({ id: '51c42bb4-931a-456b-bff7-e5a8a70dd298' });
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).like(actor, { type: 'Like', actor: actor.uri, object: 'https://remote.example/notes/1' } as ILike);
			expect(mocks.reactionService.create).toHaveBeenCalled();
			expect(result).toBe('ok');
		});

		test('accept skips unknown accept type', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({ type: 'Unknown' });
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).accept(actor, { type: 'Accept', actor: actor.uri, object: 'https://example.com/users/local1' } as IAccept);
			expect(result).toContain('skip');
		});

		test('acceptFollow skips when follower not found', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue(null);
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).acceptFollow(actor, { type: 'Follow', actor: 'https://example.com/users/ghost', object: actor.uri, id: 'req1' } as IFollow);
			expect(result).toContain('skip');
		});

		test('acceptFollow skips when follower is remote', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue({ id: 'remote1', host: 'remote.example' });
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).acceptFollow(actor, { type: 'Follow', actor: 'https://remote.example/users/remote1', object: actor.uri, id: 'req1' } as IFollow);
			expect(result).toContain('skip');
		});

		test('reject skips unknown reject type', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({ type: 'Unknown' });
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).reject(actor, { type: 'Reject', actor: actor.uri, object: 'https://example.com/users/local1' } as IReject);
			expect(result).toContain('skip');
		});

		test('rejectFollow skips when follower not found', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue(null);
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).rejectFollow(actor, { type: 'Follow', actor: 'https://example.com/users/ghost', object: actor.uri, id: 'req1' } as IFollow);
			expect(result).toContain('skip');
		});

		test('rejectFollow skips when follower is remote', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getUserFromApId.mockResolvedValue({ id: 'remote1', host: 'remote.example' });
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).rejectFollow(actor, { type: 'Follow', actor: 'https://remote.example/users/remote1', object: actor.uri, id: 'req1' } as IFollow);
			expect(result).toContain('skip');
		});

		test('add throws on invalid actor', async () => {
			const { service } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			await expect((service as any).add(actor, { type: 'Add', actor: 'https://other.example/users/other', target: 'x', object: 'y' } as IAdd)).rejects.toThrow('invalid actor');
		});

		test('add throws when target is null', async () => {
			const { service } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			await expect((service as any).add(actor, { type: 'Add', actor: actor.uri, target: null, object: 'y' } as unknown as IAdd)).rejects.toThrow('target is null');
		});

		test('add throws on unknown target', async () => {
			const { service } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			await expect((service as any).add(actor, { type: 'Add', actor: actor.uri, target: 'https://unknown.example/target', object: 'y' } as IAdd)).rejects.toThrow('unknown target');
		});

		test('delete throws on invalid actor', async () => {
			const { service } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			await expect((service as any).delete(actor, { type: 'Delete', actor: 'https://other.example/users/other', object: actor.uri } as IDelete)).rejects.toThrow('invalid actor');
		});

		test('deleteNote skips when note not found', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getNoteFromApId.mockResolvedValue(null);
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).deleteNote(actor, 'https://remote.example/notes/ghost');
			expect(result).toContain('not found');
		});

		test('deleteNote skips when actor does not own note', async () => {
			const { service, mocks } = createService();
			mocks.apDbResolverService.getNoteFromApId.mockResolvedValue({ id: 'note1', userId: 'other' });
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).deleteNote(actor, 'https://remote.example/notes/1');
			expect(result).toContain('作成者ではありません');
		});

		test('deleteActor skips when uri mismatch', async () => {
			const { service } = createService();
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).deleteActor(actor, 'https://other.example/users/other');
			expect(result).toContain('skip');
		});

		test('deleteActor skips when user not found', async () => {
			const { service, mocks } = createService();
			mocks.usersRepository.findOneBy.mockResolvedValue(null);
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).deleteActor(actor, actor.uri);
			expect(result).toContain('skip');
		});

		test('deleteActor skips when already deleted', async () => {
			const { service, mocks } = createService();
			mocks.usersRepository.findOneBy.mockResolvedValue({ id: 'actor', isDeleted: true });
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).deleteActor(actor, actor.uri);
			expect(result).toContain('skip');
		});

		test('flag skips when no local users match', async () => {
			const { service, mocks } = createService();
			mocks.usersRepository.findBy.mockResolvedValue([]);
			const actor = createRemoteUser('actor', 'remote.example');
			const result = await (service as any).flag(actor, { type: 'Flag', actor: actor.uri, object: ['https://example.com/users/ghost'], content: 'spam' } as IFlag);
			expect(result).toContain('skip');
		});
	});
});
