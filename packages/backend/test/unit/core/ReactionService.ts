process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { ReactionService } from '@/core/ReactionService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { EmojisRepository, NoteReactionsRepository, UsersRepository, NotesRepository } from '@/models/index.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { UserBlockingService } from '@/core/UserBlockingService.js';
import type { CustomEmojiService } from '@/core/CustomEmojiService.js';
import type { RoleService } from '@/core/RoleService.js';
import type { MetaService } from '@/core/MetaService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { NotificationService } from '@/core/NotificationService.js';
import type { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import type { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import type PerUserReactionsChart from '@/core/chart/charts/per-user-reactions.js';
import type { IdService } from '@/core/IdService.js';
import type { UtilityService } from '@/core/UtilityService.js';
import type { User } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';
import { QueryFailedError } from 'typeorm';

function createLocalUser(id: string): User {
	return {
		id,
		host: null,
		isBot: false,
		isCat: false,
	} as unknown as User;
}

function createRemoteUser(id: string, host: string): User {
	return {
		id,
		host,
		isBot: false,
		isCat: false,
	} as unknown as User;
}

function createNote(data: Partial<Note> = {}): Note {
	return {
		id: 'note1',
		userId: 'user2',
		userHost: null,
		visibility: 'public',
		text: 'hello',
		reactionAcceptance: null,
		fileIds: [],
		localOnly: false,
		visibleUserIds: [],
		...data,
	} as unknown as Note;
}

function createService() {
	const usersRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
	} as unknown as jest.Mocked<UsersRepository>;

	const notesRepository = {
		createQueryBuilder: jest.fn().mockReturnValue({
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue(undefined),
		}),
		decrement: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<NotesRepository>;

	const noteReactionsRepository = {
		insert: jest.fn().mockResolvedValue(undefined),
		findOneBy: jest.fn().mockResolvedValue(null),
		findOneByOrFail: jest.fn().mockResolvedValue({ id: 'reaction1', reaction: '❤️' }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
	} as unknown as jest.Mocked<NoteReactionsRepository>;

	const emojisRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
		findOne: jest.fn().mockResolvedValue(null),
	} as unknown as jest.Mocked<EmojisRepository>;

	const utilityService = {
		toPunyNullable: jest.fn().mockImplementation((host: string | null) => host ?? null),
	} as unknown as UtilityService;

	const metaService = {
		fetch: jest.fn().mockResolvedValue({ enableChartsForRemoteUser: false }),
	} as unknown as MetaService;

	const customEmojiService = {
		localEmojisCache: {
			fetch: jest.fn().mockResolvedValue(new Map()),
		},
	} as unknown as CustomEmojiService;

	const roleService = {
		getUserRoles: jest.fn().mockResolvedValue([]),
	} as unknown as RoleService;

	const userEntityService = {
		isLocalUser: jest.fn().mockImplementation((user: User) => user.host === null),
		isRemoteUser: jest.fn().mockImplementation((user: User) => user.host !== null),
	} as unknown as jest.Mocked<UserEntityService>;

	const noteEntityService = {
		isVisibleForMe: jest.fn().mockResolvedValue(true),
	} as unknown as NoteEntityService;

	const userBlockingService = {
		checkBlocked: jest.fn().mockResolvedValue(false),
	} as unknown as UserBlockingService;

	const idService = {
		genId: jest.fn().mockReturnValue('reaction1'),
	} as unknown as IdService;

	const globalEventService = {
		publishNoteStream: jest.fn(),
	} as unknown as GlobalEventService;

	const notificationService = {
		createNotification: jest.fn(),
	} as unknown as NotificationService;

	const apRendererService = {
		renderLike: jest.fn().mockResolvedValue({ type: 'Like' }),
		renderUndo: jest.fn().mockReturnValue({ type: 'Undo' }),
		addContext: jest.fn().mockImplementation(x => x),
	} as unknown as ApRendererService;

	const apDeliverManagerService = {
		createDeliverManager: jest.fn().mockReturnValue({
			addDirectRecipe: jest.fn(),
			addFollowersRecipe: jest.fn(),
			execute: jest.fn(),
		}),
	} as unknown as ApDeliverManagerService;

	const perUserReactionsChart = {
		update: jest.fn(),
	} as unknown as PerUserReactionsChart;

	const service = new ReactionService(
		usersRepository,
		notesRepository,
		noteReactionsRepository,
		emojisRepository,
		utilityService,
		metaService,
		customEmojiService,
		roleService,
		userEntityService,
		noteEntityService,
		userBlockingService,
		idService,
		globalEventService,
		apRendererService,
		apDeliverManagerService,
		notificationService,
		perUserReactionsChart,
	);

	return {
		service,
		mocks: {
			usersRepository,
			notesRepository,
			noteReactionsRepository,
			emojisRepository,
			utilityService,
			metaService,
			customEmojiService,
			roleService,
			userEntityService,
			noteEntityService,
			userBlockingService,
			idService,
			globalEventService,
			notificationService,
			apRendererService,
			apDeliverManagerService,
			perUserReactionsChart,
		},
	};
}

describe('ReactionService', () => {
	describe('create', () => {
		test('creates default reaction', async () => {
			const { service, mocks } = createService();
			const user = createLocalUser('user1');
			const note = createNote();

			await service.create(user, note);

			expect(mocks.noteReactionsRepository.insert).toHaveBeenCalled();
			expect(mocks.globalEventService.publishNoteStream).toHaveBeenCalled();
			expect(mocks.notificationService.createNotification).toHaveBeenCalled();
		});

		test('throws when blocked by note author', async () => {
			const { service, mocks } = createService();
			mocks.userBlockingService.checkBlocked.mockResolvedValue(true);
			const user = createLocalUser('user1');
			const note = createNote();

			await expect(service.create(user, note)).rejects.toBeInstanceOf(IdentifiableError);
		});

		test('likeOnly forces heart', async () => {
			const { service, mocks } = createService();
			const user = createLocalUser('user1');
			const note = createNote({ reactionAcceptance: 'likeOnly' });

			await service.create(user, note, '😀');

			expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: '❤️' }));
		});

		test('likeOnlyForRemote forces heart for remote user', async () => {
			const { service, mocks } = createService();
			const user = createRemoteUser('user1', 'remote.example');
			const note = createNote({ reactionAcceptance: 'likeOnlyForRemote' });

			await service.create(user, note, '😀');

			expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: '❤️' }));
		});

		test('nonSensitiveOnlyForLocalLikeOnlyForRemote forces heart for remote user', async () => {
			const { service, mocks } = createService();
			const user = createRemoteUser('user1', 'remote.example');
			const note = createNote({ reactionAcceptance: 'nonSensitiveOnlyForLocalLikeOnlyForRemote' });

			await service.create(user, note, '😀');

			expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: '❤️' }));
		});

		test('custom emoji allowed when user has required role', async () => {
			const { service, mocks } = createService();
			mocks.customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['foo', {
				name: 'foo',
				publicUrl: 'url',
				originalUrl: '',
				isSensitive: false,
				roleIdsThatCanBeUsedThisEmojiAsReaction: ['role1'],
				localOnly: false,
			} as any]]));
			mocks.roleService.getUserRoles.mockResolvedValue([{ id: 'role1' }] as any);
			const user = createLocalUser('user1');
			const note = createNote();

			await service.create(user, note, ':foo:');

			expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: ':foo:' }));
		});

		test('custom emoji reaction from local user', async () => {
			const { service, mocks } = createService();
			mocks.customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['foo', {
				name: 'foo',
				publicUrl: 'url',
				originalUrl: '',
				isSensitive: false,
				roleIdsThatCanBeUsedThisEmojiAsReaction: [],
				localOnly: false,
			} as any]]));
			const user = createLocalUser('user1');
			const note = createNote();

			await service.create(user, note, ':foo:');

			expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: ':foo:' }));
		});

		test('custom emoji fallback when role not allowed', async () => {
			const { service, mocks } = createService();
			mocks.customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['foo', {
				name: 'foo',
				publicUrl: 'url',
				originalUrl: '',
				isSensitive: false,
				roleIdsThatCanBeUsedThisEmojiAsReaction: ['role1'],
				localOnly: false,
			} as any]]));
			const user = createLocalUser('user1');
			const note = createNote();

			await service.create(user, note, ':foo:');

			expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: '❤' }));
		});

		test('nonSensitiveOnly falls back for sensitive emoji', async () => {
			const { service, mocks } = createService();
			mocks.customEmojiService.localEmojisCache.fetch.mockResolvedValue(new Map([['foo', {
				name: 'foo',
				publicUrl: 'url',
				originalUrl: '',
				isSensitive: true,
				roleIdsThatCanBeUsedThisEmojiAsReaction: [],
				localOnly: false,
			} as any]]));
			const user = createLocalUser('user1');
			const note = createNote({ reactionAcceptance: 'nonSensitiveOnly' });

			await service.create(user, note, ':foo:');

			expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: '❤' }));
		});

		test('handles duplicate key with same reaction', async () => {
			const { service, mocks } = createService();
			const err = new QueryFailedError('INSERT', [], { code: '23505' } as any);
			(err as any).driverError = { code: '23505' };
			mocks.noteReactionsRepository.insert.mockRejectedValueOnce(err);
			mocks.noteReactionsRepository.findOneByOrFail.mockResolvedValueOnce({ id: 'reaction1', reaction: '❤️' });
			const user = createLocalUser('user1');
			const note = createNote();

			await expect(service.create(user, note, '❤️')).rejects.toBeInstanceOf(IdentifiableError);
		});

		test('replaces existing different reaction on duplicate key', async () => {
			const { service, mocks } = createService();
			const err = new QueryFailedError('INSERT', [], { code: '23505' } as any);
			(err as any).driverError = { code: '23505' };
			mocks.noteReactionsRepository.insert.mockRejectedValueOnce(err);
			mocks.noteReactionsRepository.findOneByOrFail.mockResolvedValueOnce({ id: 'reaction1', reaction: '😀' });
			mocks.noteReactionsRepository.findOneBy.mockResolvedValueOnce({ id: 'reaction1', reaction: '😀' });
			const user = createLocalUser('user1');
			const note = createNote();

			await service.create(user, note, '❤️');

			expect(mocks.noteReactionsRepository.delete).toHaveBeenCalled();
			expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledTimes(2);
		});

		test('delivers to remote note author', async () => {
			const { service, mocks } = createService();
			const user = createLocalUser('user1');
			const note = createNote({ userHost: 'remote.example' });
			mocks.usersRepository.findOneBy.mockResolvedValue({ id: 'user2', host: 'remote.example' });

			await service.create(user, note);

			expect(mocks.apDeliverManagerService.createDeliverManager).toHaveBeenCalled();
		});

		test('delivers to specified visible remote users', async () => {
			const { service, mocks } = createService();
			const user = createLocalUser('user1');
			const note = createNote({ visibility: 'specified', visibleUserIds: ['user3'] });
			mocks.usersRepository.findOneBy.mockResolvedValue({ id: 'user3', host: 'remote.example' });

			await service.create(user, note);

			expect(mocks.apDeliverManagerService.createDeliverManager).toHaveBeenCalled();
		});

		test('specified visibility skips local visible users', async () => {
			const { service, mocks } = createService();
			const user = createLocalUser('user1');
			const note = createNote({ visibility: 'specified', visibleUserIds: ['local2', 'remote3'] });
			mocks.usersRepository.findOneBy.mockImplementation(({ id }: { id: string }) => id === 'remote3' ? { id: 'remote3', host: 'remote.example' } : { id, host: null });

			await service.create(user, note);

			const dm = mocks.apDeliverManagerService.createDeliverManager.mock.results[0].value;
			expect(dm.addDirectRecipe).toHaveBeenCalledTimes(1);
			expect(dm.addFollowersRecipe).not.toHaveBeenCalled();
		});

		test('updates chart for remote user when enabled', async () => {
			const { service, mocks } = createService();
			mocks.metaService.fetch.mockResolvedValue({ enableChartsForRemoteUser: true });
			const user = createRemoteUser('user1', 'remote.example');
			const note = createNote();

			await service.create(user, note);

			expect(mocks.perUserReactionsChart.update).toHaveBeenCalled();
		});

		test('remote user does not deliver activity', async () => {
			const { service, mocks } = createService();
			const user = createRemoteUser('user1', 'remote.example');
			const note = createNote();

			await service.create(user, note);

			expect(mocks.apDeliverManagerService.createDeliverManager).not.toHaveBeenCalled();
		});
	});

	describe('delete', () => {
		test('throws when not reacted', async () => {
			const { service, mocks } = createService();
			mocks.noteReactionsRepository.findOneBy.mockResolvedValue(null);
			const user = createLocalUser('user1');
			const note = createNote();

			await expect(service.delete(user, note)).rejects.toBeInstanceOf(IdentifiableError);
		});

		test('deletes reaction and delivers undo', async () => {
			const { service, mocks } = createService();
			mocks.noteReactionsRepository.findOneBy.mockResolvedValue({ id: 'reaction1', reaction: '❤️' });
			const user = createLocalUser('user1');
			const note = createNote();

			await service.delete(user, note);

			expect(mocks.noteReactionsRepository.delete).toHaveBeenCalledWith('reaction1');
			expect(mocks.apRendererService.renderUndo).toHaveBeenCalled();
		});
	});

	test('convertLegacyReactions maps old reactions', () => {
		const { service } = createService();
		const result = service.convertLegacyReactions({ 'like': 3, '😀': 2 });
		expect(result['👍']).toBe(3);
		expect(result['😀']).toBe(2);
	});

	test('convertLegacyReaction maps like', () => {
		const { service } = createService();
		expect(service.convertLegacyReaction('like')).toBe('👍');
	});

	test('create uses fallback when no reaction provided', async () => {
		const { service, mocks } = createService();
		const user = createLocalUser('user1');
		const note = createNote();

		await service.create(user, note, null);

		expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: '❤' }));
	});

	test('create skips block check for own note', async () => {
		const { service, mocks } = createService();
		const user = createLocalUser('user1');
		const note = createNote({ userId: 'user1' });

		await service.create(user, note);

		expect(mocks.userBlockingService.checkBlocked).not.toHaveBeenCalled();
	});

	test('create throws when note is not visible', async () => {
		const { service, mocks } = createService();
		mocks.noteEntityService.isVisibleForMe.mockResolvedValue(false);
		const user = createLocalUser('user1');
		const note = createNote();

		await expect(service.create(user, note)).rejects.toBeInstanceOf(IdentifiableError);
	});

	test('create normalizes unicode emoji', async () => {
		const { service, mocks } = createService();
		const user = createLocalUser('user1');
		const note = createNote();

		await service.create(user, note, '❤️');

		expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: '❤' }));
	});

	test('create uses remote custom emoji', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findOneBy.mockResolvedValue({
			name: 'foo',
			host: 'remote.example',
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			isSensitive: false,
		} as any);
		const user = createRemoteUser('user1', 'remote.example');
		const note = createNote();

		await service.create(user, note, ':foo:');

		expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: ':foo@remote.example:' }));
	});

	test('create falls back when remote custom emoji not found', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findOneBy.mockResolvedValue(null);
		const user = createRemoteUser('user1', 'remote.example');
		const note = createNote();

		await service.create(user, note, ':foo:');

		expect(mocks.noteReactionsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ reaction: '❤' }));
	});

	test('create skips score for bot user', async () => {
		const { service, mocks } = createService();
		const user = { ...createLocalUser('user1'), isBot: true };
		const note = createNote();

		await service.create(user as any, note);

		const setCall = mocks.notesRepository.createQueryBuilder().update().set.mock.calls[0][0];
		expect(setCall.score).toBeUndefined();
	});

	test('create skips delivery for localOnly note', async () => {
		const { service, mocks } = createService();
		const user = createLocalUser('user1');
		const note = createNote({ localOnly: true });

		await service.create(user, note);

		expect(mocks.apDeliverManagerService.createDeliverManager).not.toHaveBeenCalled();
	});

	test('create delivers to followers for followers visibility', async () => {
		const { service, mocks } = createService();
		const user = createLocalUser('user1');
		const note = createNote({ visibility: 'followers' });

		await service.create(user, note);

		expect(mocks.apDeliverManagerService.createDeliverManager).toHaveBeenCalled();
	});

	test('delete throws when delete affected count is not 1', async () => {
		const { service, mocks } = createService();
		mocks.noteReactionsRepository.findOneBy.mockResolvedValue({ id: 'reaction1', reaction: '❤️' });
		mocks.noteReactionsRepository.delete.mockResolvedValue({ affected: 0 } as any);
		const user = createLocalUser('user1');
		const note = createNote();

		await expect(service.delete(user, note)).rejects.toBeInstanceOf(IdentifiableError);
	});

	test('delete skips score decrement for bot user', async () => {
		const { service, mocks } = createService();
		mocks.noteReactionsRepository.findOneBy.mockResolvedValue({ id: 'reaction1', reaction: '❤️' });
		const user = { ...createLocalUser('user1'), isBot: true };
		const note = createNote();

		await service.delete(user as any, note);

		expect(mocks.notesRepository.decrement).not.toHaveBeenCalled();
	});

	test('delete delivers undo for remote note author', async () => {
		const { service, mocks } = createService();
		mocks.noteReactionsRepository.findOneBy.mockResolvedValue({ id: 'reaction1', reaction: '❤️' });
		mocks.usersRepository.findOneBy.mockResolvedValue({ id: 'user2', host: 'remote.example' });
		const user = createLocalUser('user1');
		const note = createNote({ userHost: 'remote.example' });

		await service.delete(user, note);

		expect(mocks.apDeliverManagerService.createDeliverManager).toHaveBeenCalled();
	});

	test('delete does not deliver for remote user', async () => {
		const { service, mocks } = createService();
		mocks.noteReactionsRepository.findOneBy.mockResolvedValue({ id: 'reaction1', reaction: '❤️' });
		const user = createRemoteUser('user1', 'remote.example');
		const note = createNote();

		await service.delete(user, note);

		expect(mocks.apDeliverManagerService.createDeliverManager).not.toHaveBeenCalled();
	});

	test('convertLegacyReactions skips zero and non-legacy counts', () => {
		const { service } = createService();
		const result = service.convertLegacyReactions({ 'like': 0, '😀': 2 });
		expect(result['like']).toBeUndefined();
		expect(result['😀']).toBe(2);
	});

	test('convertLegacyReactions adds to existing mapped entry', () => {
		const { service } = createService();
		const result = service.convertLegacyReactions({ 'like': 3, '👍': 2 });
		expect(result['👍']).toBe(5);
	});

	describe('decodeReaction', () => {
		test('decodes local custom emoji', () => {
			const { service } = createService();
			expect(service.decodeReaction(':foo:')).toEqual({ reaction: ':foo@.:', name: 'foo', host: null });
		});

		test('decodes remote custom emoji', () => {
			const { service } = createService();
			expect(service.decodeReaction(':foo@remote.example:')).toEqual({ reaction: ':foo@remote.example:', name: 'foo', host: 'remote.example' });
		});

		test('returns unicode as-is', () => {
			const { service } = createService();
			expect(service.decodeReaction('😀')).toEqual({ reaction: '😀' });
		});
	});

	describe('normalize', () => {
		test('maps legacy reaction', () => {
			const { service } = createService();
			expect(service.normalize('love')).toBe('❤');
		});

		test('returns fallback for invalid', () => {
			const { service } = createService();
			expect(service.normalize('invalid')).toBe('❤');
		});

		test('normalizes unicode emoji', () => {
			const { service } = createService();
			expect(service.normalize('❤️')).toBe('❤');
		});
	});
});
