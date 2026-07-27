process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { HomeTimelineChannelService } from '@/server/api/stream/channels/home-timeline.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
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

function createPackedNote(data: Partial<Packed<'Note'>> = {}): Packed<'Note'> {
	return {
		id: 'note1',
		createdAt: new Date().toISOString(),
		userId: 'other1',
		user: {
			id: 'other1',
			name: null,
			username: 'bob',
			host: null,
			avatarUrl: null,
			avatarBlurhash: null,
			isBot: false,
			isCat: false,
			instance: null,
			emojis: [],
			onlineStatus: 'unknown',
			badgeRoles: [],
		},
		text: 'hello',
		cw: null,
		visibility: 'public',
		noteVisibility: 'public',
		localOnly: false,
		reactionAcceptance: null,
		reactions: {},
		reactionCount: 0,
		renoteCount: 0,
		repliesCount: 0,
		fileIds: [],
		files: [],
		replyId: null,
		renoteId: null,
		...data,
	} as unknown as Packed<'Note'>;
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

async function flushPromises(): Promise<void> {
	return new Promise(resolve => setImmediate(resolve));
}

describe('HomeTimelineChannel', () => {
	describe('init', () => {
		test('stores withReplies param and subscribes to notesStream', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);

			await channel.init({ withReplies: true });

			expect(connection.subscriber.listenerCount('notesStream')).toBe(1);
		});
	});

	describe('onNote', () => {
		test('sends note from the connected user', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: connection.user!.id, text: 'self note' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.cacheNote).toHaveBeenCalledWith(note);
			expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
				id: channel.id,
				type: 'note',
				body: note,
			});
		});

		test('sends note from a followed user', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ following: new Set(['other1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'other1', text: 'followed note' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('filters note from non-self non-followed user', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'stranger1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters note from muted instance', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({
				userProfile: createUserProfile({ mutedInstances: ['remote.example'] }),
				following: new Set(['other1']),
			});
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'other1' });
			(note.user as Packed<'User'>).host = 'remote.example';

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('repacks followers note and filters when hidden', async () => {
			const noteEntityService = createNoteEntityService();
			noteEntityService.pack.mockResolvedValue({ isHidden: true } as unknown as Packed<'Note'>);
			const connection = createConnection({ following: new Set(['other1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'other1', visibility: 'followers' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(noteEntityService.pack).toHaveBeenCalledWith(note.id, connection.user, { detail: true });
			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('repacks followers note and sends when not hidden', async () => {
			const noteEntityService = createNoteEntityService();
			const repacked = createPackedNote({ id: 'repacked1', userId: 'other1', visibility: 'followers', isHidden: false });
			noteEntityService.pack.mockResolvedValue(repacked);
			const connection = createConnection({ following: new Set(['other1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'other1', visibility: 'followers' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
				id: channel.id,
				type: 'note',
				body: repacked,
			});
		});

		test('repacks specified note and sends when not hidden', async () => {
			const noteEntityService = createNoteEntityService();
			const repacked = createPackedNote({ id: 'repacked2', userId: 'other1', visibility: 'specified', isHidden: false });
			noteEntityService.pack.mockResolvedValue(repacked);
			const connection = createConnection({ following: new Set(['other1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'other1', visibility: 'specified' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('repacks reply when replyId is present', async () => {
			const noteEntityService = createNoteEntityService();
			const reply = createPackedNote({ id: 'reply1', userId: 'replyuser1' });
			noteEntityService.pack.mockResolvedValue(reply);
			const connection = createConnection({ following: new Set(['other1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: true });
			const note = createPackedNote({ userId: 'other1', replyId: 'reply1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(noteEntityService.pack).toHaveBeenCalledWith('reply1', connection.user, { detail: true });
			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('repacks renote when renoteId is present', async () => {
			const noteEntityService = createNoteEntityService();
			const renote = createPackedNote({ id: 'renote1', userId: 'renoteuser1' });
			noteEntityService.pack.mockResolvedValue(renote);
			const connection = createConnection({ following: new Set(['other1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: true });
			const note = createPackedNote({ userId: 'other1', renoteId: 'renote1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(noteEntityService.pack).toHaveBeenCalledWith('renote1', connection.user, { detail: true });
			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('filters unrelated reply when withReplies is false', async () => {
			const noteEntityService = createNoteEntityService();
			const reply = createPackedNote({ id: 'reply1', userId: 'replyuser1' });
			noteEntityService.pack.mockResolvedValue(reply);
			const connection = createConnection({ following: new Set(['other1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'other1', replyId: 'reply1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('sends reply to connected user when withReplies is false', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ following: new Set(['other1']) });
			const reply = createPackedNote({ id: 'reply1', userId: connection.user!.id });
			noteEntityService.pack.mockResolvedValue(reply);
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'other1', replyId: 'reply1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('sends self-reply when withReplies is false', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const reply = createPackedNote({ id: 'reply1', userId: connection.user!.id });
			noteEntityService.pack.mockResolvedValue(reply);
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: connection.user!.id, replyId: 'reply1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('sends reply to note author when withReplies is false', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ following: new Set(['other1']) });
			const reply = createPackedNote({ id: 'reply1', userId: 'other1' });
			noteEntityService.pack.mockResolvedValue(reply);
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'other1', replyId: 'reply1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('sends unrelated reply when withReplies is true', async () => {
			const noteEntityService = createNoteEntityService();
			const reply = createPackedNote({ id: 'reply1', userId: 'replyuser1' });
			noteEntityService.pack.mockResolvedValue(reply);
			const connection = createConnection({ following: new Set(['other1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: true });
			const note = createPackedNote({ userId: 'other1', replyId: 'reply1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('filters note involving muted user', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ userIdsWhoMeMuting: new Set(['baduser1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'baduser1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters note involving blocking user', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ userIdsWhoBlockingMe: new Set(['baduser1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'baduser1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters pure renote involving muted renote user', async () => {
			const noteEntityService = createNoteEntityService();
			const renote = createPackedNote({ id: 'renote1', userId: 'baduser1', text: null });
			noteEntityService.pack.mockResolvedValue(renote);
			const connection = createConnection({ userIdsWhoMeMutingRenotes: new Set(['baduser1']) });
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ renoteId: 'renote1', text: null });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters word-muted note', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({
				userProfile: createUserProfile({ mutedWords: [['blockedword']] }),
			});
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ userId: 'other1', text: 'hello blockedword' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});
	});

	describe('dispose', () => {
		test('unsubscribes from notesStream', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			expect(connection.subscriber.listenerCount('notesStream')).toBe(1);

			channel.dispose!();

			expect(connection.subscriber.listenerCount('notesStream')).toBe(0);
		});
	});

	describe('onMessage', () => {
		test('does not implement onMessage', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new HomeTimelineChannelService(noteEntityService);
			const channel = service.create('channel1', connection);

			expect(channel.onMessage).toBeUndefined();
		});
	});
});
