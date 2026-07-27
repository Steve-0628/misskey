process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { MainChannelService } from '@/server/api/stream/channels/main.js';
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

describe('MainChannel', () => {
	describe('init', () => {
		test('subscribes to main stream for user', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);

			await channel.init({});

			expect(connection.subscriber.listenerCount('mainStream:user1')).toBe(1);
		});
	});

	describe('onMainStreamData', () => {
		test('forwards unrelated event types', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({});

			connection.subscriber.emit('mainStream:user1', { type: 'readAllNotifications', body: {} });
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
				id: channel.id,
				type: 'readAllNotifications',
				body: {},
			});
		});

		test('filters notification from muted instance', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({
				userProfile: createUserProfile({ mutedInstances: ['remote.example'] }),
			});
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({});

			connection.subscriber.emit('mainStream:user1', {
				type: 'notification',
				body: { userId: 'other1', user: { host: 'remote.example' } },
			});
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters notification from muted user', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ userIdsWhoMeMuting: new Set(['other1']) });
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({});

			connection.subscriber.emit('mainStream:user1', {
				type: 'notification',
				body: { userId: 'other1' },
			});
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('repacks hidden note in notification and sends', async () => {
			const noteEntityService = createNoteEntityService();
			const repacked = { id: 'note1', isHidden: false } as unknown as Packed<'Note'>;
			noteEntityService.pack.mockResolvedValue(repacked);
			const connection = createConnection();
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({});

			connection.subscriber.emit('mainStream:user1', {
				type: 'notification',
				body: { note: { id: 'note1', isHidden: true } },
			});
			await flushPromises();

			expect(noteEntityService.pack).toHaveBeenCalledWith('note1', connection.user, { detail: true });
			expect(connection.cacheNote).toHaveBeenCalledWith(repacked);
			expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
				id: channel.id,
				type: 'notification',
				body: { note: repacked },
			});
		});

		test('sends normal notification', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({});

			connection.subscriber.emit('mainStream:user1', {
				type: 'notification',
				body: { userId: 'other1' },
			});
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
				id: channel.id,
				type: 'notification',
				body: { userId: 'other1' },
			});
		});

		test('filters mention from muted instance', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({
				userProfile: createUserProfile({ mutedInstances: ['remote.example'] }),
			});
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({});

			connection.subscriber.emit('mainStream:user1', {
				type: 'mention',
				body: { userId: 'other1', user: { host: 'remote.example' } },
			});
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters mention from muted user', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ userIdsWhoMeMuting: new Set(['other1']) });
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({});

			connection.subscriber.emit('mainStream:user1', {
				type: 'mention',
				body: { userId: 'other1', user: { host: null } },
			});
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('repacks hidden mention and sends', async () => {
			const noteEntityService = createNoteEntityService();
			const repacked = { id: 'note1', isHidden: false } as unknown as Packed<'Note'>;
			noteEntityService.pack.mockResolvedValue(repacked);
			const connection = createConnection();
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({});

			connection.subscriber.emit('mainStream:user1', {
				type: 'mention',
				body: { id: 'note1', userId: 'other1', isHidden: true, user: { host: null } },
			});
			await flushPromises();

			expect(noteEntityService.pack).toHaveBeenCalledWith('note1', connection.user, { detail: true });
			expect(connection.cacheNote).toHaveBeenCalledWith(repacked);
			expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
				id: channel.id,
				type: 'mention',
				body: repacked,
			});
		});
	});

	describe('dispose', () => {
		test('unsubscribes from main stream', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new MainChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({});

			channel.dispose();

			expect(connection.subscriber.listenerCount('mainStream:user1')).toBe(0);
		});
	});
});
