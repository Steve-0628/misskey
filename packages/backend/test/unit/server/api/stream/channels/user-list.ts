process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { UserListChannelService } from '@/server/api/stream/channels/user-list.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { UserListsRepository, UserListJoiningsRepository } from '@/models/index.js';
import type Connection from '@/server/api/stream/index.js';
import type { StreamEventEmitter } from '@/server/api/stream/types.js';
import type { User } from '@/models/entities/User.js';
import type { UserProfile } from '@/models/entities/UserProfile.js';
import type { Packed } from '@/misc/json-schema.js';

function createUser(data: Partial<User> = {}): User {
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
		token: 'token',
		...data,
	} as unknown as User;
}

function createUserProfile(data: Partial<UserProfile> = {}): UserProfile {
	return {
		userId: 'user1',
		autoAcceptFollowed: false,
		autoRejectFollowRequest: false,
		noCrawle: false,
		preventAiLearning: false,
		alwaysMarkNsfw: false,
		autoSensitive: false,
		carefulBot: false,
		carefulMassive: false,
		publicReactions: false,
		ffVisibility: 'public',
		hideOnlineStatus: false,
		mutingNotificationTypes: [],
		emailNotificationTypes: [],
		achievementPopup: false,
		enabled: true,
		security: false,
		usePasswordLessLogin: false,
		mutedWords: [],
		mutedInstances: [],
		...data,
	} as unknown as UserProfile;
}

function createConnection(partial: Partial<Connection> = {}): Connection {
	const user = createUser();
	const userProfile = createUserProfile();
	return {
		user,
		userProfile,
		following: new Set<string>(),
		userIdsWhoMeMuting: new Set<string>(),
		userIdsWhoMeMutingRenotes: new Set<string>(),
		userIdsWhoBlockingMe: new Set<string>(),
		subscriber: new EventEmitter() as unknown as StreamEventEmitter,
		cacheNote: jest.fn(),
		sendMessageToWs: jest.fn(),
		...partial,
	} as unknown as Connection;
}

function createNoteEntityService(): jest.Mocked<NoteEntityService> {
	return {
		pack: jest.fn(),
	} as unknown as jest.Mocked<NoteEntityService>;
}

function createUserListsRepository(exists = true): jest.Mocked<UserListsRepository> {
	return {
		exist: jest.fn().mockResolvedValue(exists),
	} as unknown as jest.Mocked<UserListsRepository>;
}

function createUserListJoiningsRepository(users: string[] = []): jest.Mocked<UserListJoiningsRepository> {
	return {
		find: jest.fn().mockResolvedValue(users.map(id => ({ userId: id }))),
	} as unknown as jest.Mocked<UserListJoiningsRepository>;
}

async function flushPromises(): Promise<void> {
	return new Promise(resolve => setImmediate(resolve));
}

describe('UserListChannel', () => {
	describe('init', () => {
		test('subscribes and starts interval when list exists and belongs to user', async () => {
			const userListsRepository = createUserListsRepository(true);
			const userListJoiningsRepository = createUserListJoiningsRepository(['listuser1']);
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new UserListChannelService(userListsRepository, userListJoiningsRepository, noteEntityService);
			const channel = service.create('channel1', connection);

			await channel.init({ listId: 'list1' });

			expect(userListsRepository.exist).toHaveBeenCalledWith({ where: { id: 'list1', userId: 'user1' } });
			expect(connection.subscriber.listenerCount('userListStream:list1')).toBe(1);
			expect(connection.subscriber.listenerCount('notesStream')).toBe(1);
			expect(channel.listUsers).toEqual(['listuser1']);

			channel.dispose();
		});

		test('does nothing when list does not exist', async () => {
			const userListsRepository = createUserListsRepository(false);
			const userListJoiningsRepository = createUserListJoiningsRepository();
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new UserListChannelService(userListsRepository, userListJoiningsRepository, noteEntityService);
			const channel = service.create('channel1', connection);

			await channel.init({ listId: 'list1' });

			expect(connection.subscriber.listenerCount('userListStream:list1')).toBe(0);
			expect(connection.subscriber.listenerCount('notesStream')).toBe(0);
		});
	});

	describe('onNote', () => {
		test('sends note from list user', async () => {
			const userListsRepository = createUserListsRepository(true);
			const userListJoiningsRepository = createUserListJoiningsRepository(['listuser1']);
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new UserListChannelService(userListsRepository, userListJoiningsRepository, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ listId: 'list1' });
			const note = { id: 'note1', userId: 'listuser1', visibility: 'public' } as unknown as Packed<'Note'>;

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
				id: channel.id,
				type: 'note',
				body: note,
			});

			channel.dispose();
		});

		test('filters note from non-list user', async () => {
			const userListsRepository = createUserListsRepository(true);
			const userListJoiningsRepository = createUserListJoiningsRepository(['listuser1']);
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new UserListChannelService(userListsRepository, userListJoiningsRepository, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ listId: 'list1' });
			const note = { id: 'note1', userId: 'other1', visibility: 'public' } as unknown as Packed<'Note'>;

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();

			channel.dispose();
		});

		test('packs followers note and filters hidden', async () => {
			const userListsRepository = createUserListsRepository(true);
			const userListJoiningsRepository = createUserListJoiningsRepository(['listuser1']);
			const noteEntityService = createNoteEntityService();
			const packed = { id: 'note1', userId: 'listuser1', isHidden: true } as unknown as Packed<'Note'>;
			noteEntityService.pack.mockResolvedValue(packed);
			const connection = createConnection();
			const service = new UserListChannelService(userListsRepository, userListJoiningsRepository, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ listId: 'list1' });
			const note = { id: 'note1', userId: 'listuser1', visibility: 'followers' } as unknown as Packed<'Note'>;

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(noteEntityService.pack).toHaveBeenCalledWith('note1', connection.user, { detail: true });
			expect(connection.sendMessageToWs).not.toHaveBeenCalled();

			channel.dispose();
		});

		test('packs reply and renote', async () => {
			const userListsRepository = createUserListsRepository(true);
			const userListJoiningsRepository = createUserListJoiningsRepository(['listuser1']);
			const noteEntityService = createNoteEntityService();
			const reply = { id: 'reply1' } as unknown as Packed<'Note'>;
			const renote = { id: 'renote1' } as unknown as Packed<'Note'>;
			noteEntityService.pack.mockImplementation(async (id: string) => {
				if (id === 'reply1') return reply;
				if (id === 'renote1') return renote;
				return { id } as unknown as Packed<'Note'>;
			});
			const connection = createConnection();
			const service = new UserListChannelService(userListsRepository, userListJoiningsRepository, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ listId: 'list1' });
			const note = { id: 'note1', userId: 'listuser1', visibility: 'public', replyId: 'reply1', renoteId: 'renote1', text: 'hello' } as unknown as Packed<'Note'>;

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(noteEntityService.pack).toHaveBeenCalledWith('reply1', connection.user, { detail: true });
			expect(noteEntityService.pack).toHaveBeenCalledWith('renote1', connection.user, { detail: true });
			expect(connection.sendMessageToWs).toHaveBeenCalled();

			channel.dispose();
		});

		test('filters note involving muted user', async () => {
			const userListsRepository = createUserListsRepository(true);
			const userListJoiningsRepository = createUserListJoiningsRepository(['listuser1']);
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ userIdsWhoMeMuting: new Set(['listuser1']) });
			const service = new UserListChannelService(userListsRepository, userListJoiningsRepository, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ listId: 'list1' });
			const note = { id: 'note1', userId: 'listuser1', visibility: 'public' } as unknown as Packed<'Note'>;

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();

			channel.dispose();
		});

		test('filters pure renote involving muted renote user', async () => {
			const userListsRepository = createUserListsRepository(true);
			const userListJoiningsRepository = createUserListJoiningsRepository(['listuser1']);
			const noteEntityService = createNoteEntityService();
			noteEntityService.pack.mockResolvedValue({ id: 'renote1', userId: 'renoteUser1' } as unknown as Packed<'Note'>);
			const connection = createConnection({ userIdsWhoMeMutingRenotes: new Set(['renoteUser1']) });
			const service = new UserListChannelService(userListsRepository, userListJoiningsRepository, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ listId: 'list1' });
			const note = { id: 'note1', userId: 'listuser1', visibility: 'public', renoteId: 'renote1', renote: { userId: 'renoteUser1' }, text: null } as unknown as Packed<'Note'>;

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();

			channel.dispose();
		});
	});

	describe('dispose', () => {
		test('unsubscribes and clears interval', async () => {
			const userListsRepository = createUserListsRepository(true);
			const userListJoiningsRepository = createUserListJoiningsRepository();
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new UserListChannelService(userListsRepository, userListJoiningsRepository, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ listId: 'list1' });

			channel.dispose();

			expect(connection.subscriber.listenerCount('userListStream:list1')).toBe(0);
			expect(connection.subscriber.listenerCount('notesStream')).toBe(0);
		});
	});
});
