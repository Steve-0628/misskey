process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { AntennaChannelService } from '@/server/api/stream/channels/antenna.js';
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

describe('AntennaChannel', () => {
	describe('init', () => {
		test('stores antennaId and subscribes to antenna stream', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new AntennaChannelService(noteEntityService);
			const channel = service.create('channel1', connection);

			await channel.init({ antennaId: 'antenna1' });

			expect(connection.subscriber.listenerCount('antennaStream:antenna1')).toBe(1);
		});
	});

	describe('onEvent', () => {
		test('packs and sends note', async () => {
			const noteEntityService = createNoteEntityService();
			const note = { id: 'note1', userId: 'other1', text: 'hello' } as unknown as Packed<'Note'>;
			noteEntityService.pack.mockResolvedValue(note);
			const connection = createConnection();
			const service = new AntennaChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ antennaId: 'antenna1' });

			connection.subscriber.emit('antennaStream:antenna1', { type: 'note', body: { id: 'note1' } });
			await flushPromises();

			expect(noteEntityService.pack).toHaveBeenCalledWith('note1', connection.user, { detail: true });
			expect(connection.cacheNote).toHaveBeenCalledWith(note);
			expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
				id: channel.id,
				type: 'note',
				body: note,
			});
		});

		test('filters note involving muted user', async () => {
			const noteEntityService = createNoteEntityService();
			const note = { id: 'note1', userId: 'muted1', text: 'hello' } as unknown as Packed<'Note'>;
			noteEntityService.pack.mockResolvedValue(note);
			const connection = createConnection({ userIdsWhoMeMuting: new Set(['muted1']) });
			const service = new AntennaChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ antennaId: 'antenna1' });

			connection.subscriber.emit('antennaStream:antenna1', { type: 'note', body: { id: 'note1' } });
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters note involving blocking user', async () => {
			const noteEntityService = createNoteEntityService();
			const note = { id: 'note1', userId: 'blocked1', text: 'hello' } as unknown as Packed<'Note'>;
			noteEntityService.pack.mockResolvedValue(note);
			const connection = createConnection({ userIdsWhoBlockingMe: new Set(['blocked1']) });
			const service = new AntennaChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ antennaId: 'antenna1' });

			connection.subscriber.emit('antennaStream:antenna1', { type: 'note', body: { id: 'note1' } });
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('filters pure renote involving muted renote user', async () => {
			const noteEntityService = createNoteEntityService();
			const note = { id: 'note1', userId: 'other1', renote: { userId: 'mutedRenote1' }, renoteId: 'renote1', text: null } as unknown as Packed<'Note'>;
			noteEntityService.pack.mockResolvedValue(note);
			const connection = createConnection({ userIdsWhoMeMutingRenotes: new Set(['mutedRenote1']) });
			const service = new AntennaChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ antennaId: 'antenna1' });

			connection.subscriber.emit('antennaStream:antenna1', { type: 'note', body: { id: 'note1' } });
			await flushPromises();

			expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		});

		test('sends non-note events directly', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new AntennaChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ antennaId: 'antenna1' });

			connection.subscriber.emit('antennaStream:antenna1', { type: 'somethingElse', body: { foo: 'bar' } });
			await flushPromises();

			expect(noteEntityService.pack).not.toHaveBeenCalled();
			expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
				id: channel.id,
				type: 'somethingElse',
				body: { foo: 'bar' },
			});
		});
	});

	describe('dispose', () => {
		test('unsubscribes from antenna stream', async () => {
			const noteEntityService = createNoteEntityService();
			const connection = createConnection();
			const service = new AntennaChannelService(noteEntityService);
			const channel = service.create('channel1', connection);
			await channel.init({ antennaId: 'antenna1' });

			channel.dispose();

			expect(connection.subscriber.listenerCount('antennaStream:antenna1')).toBe(0);
		});
	});
});
