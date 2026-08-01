process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { EventEmitter } from 'events';
import { GlobalTimelineChannelService } from '@/server/api/stream/channels/global-timeline.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { MetaService } from '@/core/MetaService.js';
import type { RoleService } from '@/core/RoleService.js';
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

function createMetaService(): jest.Mocked<MetaService> {
	return {
		fetch: jest.fn(),
	} as unknown as jest.Mocked<MetaService>;
}

function createRoleService(policies: { gtlAvailable: boolean } = { gtlAvailable: true }): jest.Mocked<RoleService> {
	return {
		getUserPolicies: jest.fn().mockResolvedValue(policies),
	} as unknown as jest.Mocked<RoleService>;
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

async function flushPromises(): Promise<void> {
	return new Promise(resolve => setImmediate(resolve));
}

describe('GlobalTimelineChannel', () => {
	describe('init', () => {
		test('subscribes to notesStream when gtlAvailable policy is true', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);

			await channel.init({ withReplies: true });

			expect(roleService.getUserPolicies).toHaveBeenCalledWith('user1');
			expect(connection.subscriber.listenerCount('notesStream')).toBe(1);
		});

		test('does not subscribe when gtlAvailable policy is false', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: false });
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);

			await channel.init({ withReplies: true });

			expect(connection.subscriber.listenerCount('notesStream')).toBe(0);
		});
	});

	describe('onNote', () => {
		test('sends public note from any host', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ user: { host: 'remote.example' } as unknown as Packed<'Note'>['user'] });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('filters non-public note', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ visibility: 'home' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters note from muted instance', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({
				userProfile: createUserProfile({ mutedInstances: ['remote.example'] }),
			});
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ user: { host: 'remote.example' } as unknown as Packed<'Note'>['user'] });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters unrelated reply when withReplies is false', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			noteEntityService.pack.mockResolvedValue({ id: 'reply1', userId: 'replyuser1' } as unknown as Packed<'Note'>);
			const connection = createConnection();
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ replyId: 'reply1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('sends reply when withReplies is true', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			noteEntityService.pack.mockResolvedValue(createPackedNote({ id: 'reply1', userId: 'other1' }));
			const connection = createConnection();
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: true });
			const note = createPackedNote({ replyId: 'reply1' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).toHaveBeenCalled();
		});

		test('filters note involving muted user', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ userIdsWhoMeMuting: new Set(['other1']) });
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote();

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters note involving blocking user', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({ userIdsWhoBlockingMe: new Set(['other1']) });
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote();

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters word-muted note', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			const connection = createConnection({
				userProfile: createUserProfile({ mutedWords: [['spam']] }),
			});
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });
			const note = createPackedNote({ text: 'this is spam' });

			connection.subscriber.emit('notesStream', note);
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});
	});

	describe('dispose', () => {
		test('unsubscribes from notesStream', async () => {
			const metaService = createMetaService();
			const roleService = createRoleService({ gtlAvailable: true });
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new GlobalTimelineChannelService(metaService, roleService, noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ withReplies: false });

			channel.dispose();

			expect(connection.subscriber.listenerCount('notesStream')).toBe(0);
		});
	});
});
