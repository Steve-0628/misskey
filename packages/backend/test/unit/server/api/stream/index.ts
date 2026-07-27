process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import Connection from '@/server/api/stream/index.js';
import type { ChannelsService } from '@/server/api/stream/ChannelsService.js';
import type { NoteReadService } from '@/core/NoteReadService.js';
import type { NotificationService } from '@/core/NotificationService.js';
import type { CacheService } from '@/core/CacheService.js';
import type { User } from '@/models/entities/User.js';
import type { AccessToken } from '@/models/entities/AccessToken.js';
import type { StreamEventEmitter, StreamMessages } from '@/server/api/stream/types.js';
import type Channel from '@/server/api/stream/channel.js';
import type * as WebSocket from 'ws';

function createUser(partial: Partial<User> = {}): User {
	return {
		id: 'user1',
		createdAt: new Date(),
		updatedAt: null,
		lastFetchedAt: null,
		lastActiveDate: null,
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
		token: null,
		...partial,
	} as unknown as User;
}

function createAccessToken(partial: Partial<AccessToken> = {}): AccessToken {
	return {
		id: 'token1',
		createdAt: new Date(),
		lastUsedAt: null,
		token: 'test-token',
		session: null,
		hash: 'hash',
		userId: 'user1',
		user: null,
		appId: null,
		app: null,
		name: null,
		description: null,
		iconUrl: null,
		permission: [],
		fetched: false,
		...partial,
	} as unknown as AccessToken;
}

function createWsConnection(): jest.Mocked<WebSocket.WebSocket> & EventEmitter {
	const ee = new EventEmitter();
	return Object.assign(ee, {
		on: jest.fn((event: string | symbol, listener: (...args: any[]) => void) => EventEmitter.prototype.on.call(ee, event, listener)),
		off: jest.fn((event: string | symbol, listener: (...args: any[]) => void) => EventEmitter.prototype.off.call(ee, event, listener)),
		send: jest.fn(),
	}) as unknown as jest.Mocked<WebSocket.WebSocket> & EventEmitter;
}

function createSubscriber(): StreamEventEmitter {
	return new EventEmitter() as unknown as StreamEventEmitter;
}

function createCacheService(): jest.Mocked<CacheService> {
	return {
		userProfileCache: { fetch: jest.fn() },
		userFollowingsCache: { fetch: jest.fn() },
		userMutingsCache: { fetch: jest.fn() },
		userBlockedCache: { fetch: jest.fn() },
		renoteMutingsCache: { fetch: jest.fn() },
	} as unknown as jest.Mocked<CacheService>;
}

function createNoteReadService(): jest.Mocked<NoteReadService> {
	return {
		read: jest.fn(),
	} as unknown as jest.Mocked<NoteReadService>;
}

function createNotificationService(): jest.Mocked<NotificationService> {
	return {
		readAllNotification: jest.fn(),
	} as unknown as jest.Mocked<NotificationService>;
}

function createChannel(id: string, chName: string, overrides: Partial<Channel> = {}): Channel {
	return {
		id,
		chName,
		init: jest.fn(),
		dispose: jest.fn(),
		onMessage: jest.fn(),
		send: jest.fn(),
		connection: {} as never,
		user: undefined,
		userProfile: null,
		following: new Set(),
		userIdsWhoMeMuting: new Set(),
		userIdsWhoMeMutingRenotes: new Set(),
		userIdsWhoBlockingMe: new Set(),
		subscriber: createSubscriber(),
		...overrides,
	} as unknown as Channel;
}

function createChannelService(channelName: string, channelFactory?: (id: string, connection: Connection) => Channel) {
	return {
		shouldShare: false,
		requireCredential: false,
		create: jest.fn().mockImplementation((id: string, connection: Connection) => {
			return channelFactory ? channelFactory(id, connection) : createChannel(id, channelName);
		}),
	};
}

function createChannelsService(): jest.Mocked<ChannelsService> {
	const services = new Map<string, ReturnType<typeof createChannelService>>();
	return {
		getChannelService: jest.fn().mockImplementation((name: string) => {
			if (!services.has(name)) {
				services.set(name, createChannelService(name));
			}
			return services.get(name)!;
		}),
	} as unknown as jest.Mocked<ChannelsService>;
}

function flushPromises(): Promise<void> {
	return new Promise(resolve => setImmediate(resolve));
}

describe('Connection', () => {
	let channelsService: jest.Mocked<ChannelsService>;
	let noteReadService: jest.Mocked<NoteReadService>;
	let notificationService: jest.Mocked<NotificationService>;
	let cacheService: jest.Mocked<CacheService>;
	let wsConnection: jest.Mocked<WebSocket.WebSocket> & EventEmitter;
	let subscriber: StreamEventEmitter;
	let connection: Connection;

	beforeEach(() => {
		channelsService = createChannelsService();
		noteReadService = createNoteReadService();
		notificationService = createNotificationService();
		cacheService = createCacheService();
		wsConnection = createWsConnection();
		subscriber = createSubscriber();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	function createConnection(user?: User | null, token?: AccessToken | null): Connection {
		return new Connection(
			channelsService,
			noteReadService,
			notificationService,
			cacheService,
			user,
			token,
		);
	}

	function sendWsMessage(obj: Record<string, unknown>): void {
		wsConnection.emit('message', Buffer.from(JSON.stringify(obj)));
	}

	describe('constructor', () => {
		test('assigns user and token when provided', () => {
			const user = createUser();
			const token = createAccessToken();
			connection = createConnection(user, token);

			expect(connection.user).toBe(user);
			expect(connection.token).toBe(token);
		});

		test('leaves user and token undefined when omitted', () => {
			connection = createConnection();

			expect(connection.user).toBeUndefined();
			expect(connection.token).toBeUndefined();
		});
	});

	describe('fetch', () => {
		test('returns early when user is not set', async () => {
			connection = createConnection();

			await connection.fetch();

			expect(cacheService.userProfileCache.fetch).not.toHaveBeenCalled();
		});

		test('populates user data from cache', async () => {
			connection = createConnection(createUser());
			cacheService.userProfileCache.fetch.mockResolvedValue({ userId: 'user1' } as never);
			cacheService.userFollowingsCache.fetch.mockResolvedValue(new Set(['user2']));
			cacheService.userMutingsCache.fetch.mockResolvedValue(new Set(['user3']));
			cacheService.userBlockedCache.fetch.mockResolvedValue(new Set(['user4']));
			cacheService.renoteMutingsCache.fetch.mockResolvedValue(new Set(['user5']));

			await connection.fetch();

			expect(cacheService.userProfileCache.fetch).toHaveBeenCalledWith('user1');
			expect(connection.userProfile).toEqual({ userId: 'user1' });
			expect(connection.following).toEqual(new Set(['user2']));
			expect(connection.userIdsWhoMeMuting).toEqual(new Set(['user3']));
			expect(connection.userIdsWhoBlockingMe).toEqual(new Set(['user4']));
			expect(connection.userIdsWhoMeMutingRenotes).toEqual(new Set(['user5']));
		});
	});

	describe('init', () => {
		test('does nothing when user is not set', async () => {
			connection = createConnection();
			const fetchSpy = jest.spyOn(connection, 'fetch');

			await connection.init();

			expect(fetchSpy).not.toHaveBeenCalled();
		});

		test('fetches user data and starts interval when user is set', async () => {
			jest.useFakeTimers();
			connection = createConnection(createUser());
			cacheService.userProfileCache.fetch.mockResolvedValue({ userId: 'user1' } as never);
			cacheService.userFollowingsCache.fetch.mockResolvedValue(new Set());
			cacheService.userMutingsCache.fetch.mockResolvedValue(new Set());
			cacheService.userBlockedCache.fetch.mockResolvedValue(new Set());
			cacheService.renoteMutingsCache.fetch.mockResolvedValue(new Set());

			await connection.init();

			expect(cacheService.userProfileCache.fetch).toHaveBeenCalledWith('user1');
			jest.advanceTimersByTime(1000 * 10);
			expect(cacheService.userProfileCache.fetch).toHaveBeenCalledTimes(2);
		});
	});

	describe('listen', () => {
		test('registers ws message handler and subscriber broadcast handler', async () => {
			connection = createConnection();
			await connection.listen(subscriber as never, wsConnection);

			expect(wsConnection.on).toHaveBeenCalledWith('message', expect.any(Function));
		});

		test('forwards broadcast events to websocket', async () => {
			connection = createConnection();
			await connection.listen(subscriber as never, wsConnection);

			subscriber.emit('broadcast', { type: 'emojiAdded', body: { emoji: {} } } as StreamMessages['broadcast']['payload']);
			await flushPromises();

			expect(wsConnection.send).toHaveBeenCalledWith(JSON.stringify({
				type: 'emojiAdded',
				body: { emoji: {} },
			}));
		});
	});

	describe('onWsConnectionMessage', () => {
		beforeEach(async () => {
			connection = createConnection();
			await connection.listen(subscriber as never, wsConnection);
		});

		test('ignores invalid JSON', async () => {
			wsConnection.emit('message', Buffer.from('not json'));
			await flushPromises();

			expect(wsConnection.send).not.toHaveBeenCalled();
		});

		test('handles readNotification message', async () => {
			connection.user = createUser();

			sendWsMessage({ type: 'readNotification' });
			await flushPromises();

			expect(notificationService.readAllNotification).toHaveBeenCalledWith('user1');
		});

		test('handles subNote message', async () => {
			sendWsMessage({ type: 'subNote', body: { id: 'note1' } });
			await flushPromises();

			expect(subscriber.listenerCount('noteStream:note1')).toBe(1);
		});

		test('handles sr message and reads note', async () => {
			connection.user = createUser();

			const note = { id: 'note1', userId: 'other1', mentions: ['user1'] };
			connection.cacheNote(note as never);
			noteReadService.read.mockResolvedValue();

			sendWsMessage({ type: 'sr', body: { id: 'note1' } });
			await flushPromises();

			expect(noteReadService.read).toHaveBeenCalledWith('user1', [note]);
		});

		test('handles unsubNote message', async () => {
			sendWsMessage({ type: 'subNote', body: { id: 'note1' } });
			sendWsMessage({ type: 'unsubNote', body: { id: 'note1' } });
			await flushPromises();

			expect(subscriber.listenerCount('noteStream:note1')).toBe(0);
		});

		test('handles channel connect request', async () => {
			const channel = createChannel('conn1', 'testChannel');
			const channelService = createChannelService('testChannel', () => channel);
			channelsService.getChannelService.mockReturnValue(channelService);

			sendWsMessage({ type: 'connect', body: { channel: 'testChannel', id: 'conn1', params: { foo: 'bar' }, pong: true } });
			await flushPromises();

			expect(channelsService.getChannelService).toHaveBeenCalledWith('testChannel');
			expect(channel.init).toHaveBeenCalledWith({ foo: 'bar' });
			expect(wsConnection.send).toHaveBeenCalledWith(JSON.stringify({ type: 'connected', body: { id: 'conn1' } }));
		});

		test('handles channel disconnect request', async () => {
			const channel = createChannel('conn1', 'testChannel');
			const channelService = createChannelService('testChannel', () => channel);
			channelsService.getChannelService.mockReturnValue(channelService);

			sendWsMessage({ type: 'connect', body: { channel: 'testChannel', id: 'conn1' } });
			sendWsMessage({ type: 'disconnect', body: { id: 'conn1' } });
			await flushPromises();

			expect(channel.dispose).toHaveBeenCalled();
		});

		test('handles channel message request', async () => {
			const channel = createChannel('conn1', 'testChannel');
			const channelService = createChannelService('testChannel', () => channel);
			channelsService.getChannelService.mockReturnValue(channelService);

			sendWsMessage({ type: 'connect', body: { channel: 'testChannel', id: 'conn1' } });
			sendWsMessage({ type: 'channel', body: { id: 'conn1', type: 'say', body: { text: 'hi' } } });
			await flushPromises();

			expect(channel.onMessage).toHaveBeenCalledWith('say', { text: 'hi' });
		});
	});

	describe('note subscription', () => {
		beforeEach(async () => {
			connection = createConnection();
			await connection.listen(subscriber as never, wsConnection);
		});

		test('ignores subNote without id', async () => {
			sendWsMessage({ type: 'subNote', body: {} });
			await flushPromises();

			expect(subscriber.eventNames()).not.toContain('noteStream:undefined');
		});

		test('subscribes once and unsubscribes only when refcount reaches zero', async () => {
			sendWsMessage({ type: 'subNote', body: { id: 'note1' } });
			sendWsMessage({ type: 'subNote', body: { id: 'note1' } });
			sendWsMessage({ type: 'unsubNote', body: { id: 'note1' } });
			await flushPromises();

			expect(subscriber.listenerCount('noteStream:note1')).toBe(1);

			sendWsMessage({ type: 'unsubNote', body: { id: 'note1' } });
			await flushPromises();

			expect(subscriber.listenerCount('noteStream:note1')).toBe(0);
		});

		test('forwards note stream messages to websocket', async () => {
			sendWsMessage({ type: 'subNote', body: { id: 'note1' } });
			await flushPromises();

			subscriber.emit('noteStream:note1', {
				type: 'reacted',
				body: { id: 'note1', body: { reaction: 'like', userId: 'user2' } },
			} as StreamMessages['note']['payload']);
			await flushPromises();

			expect(wsConnection.send).toHaveBeenCalledWith(JSON.stringify({
				type: 'noteUpdated',
				body: {
					id: 'note1',
					type: 'reacted',
					body: { reaction: 'like', userId: 'user2' },
				},
			}));
		});
	});

	describe('connectChannel', () => {
		test('requires credential when channel requires it and user is absent', async () => {
			connection = createConnection();
			const channel = createChannel('conn1', 'main');
			const channelService = createChannelService('main', () => channel);
			channelService.requireCredential = true;
			channelsService.getChannelService.mockReturnValue(channelService);

			connection.connectChannel('conn1', {}, 'main');

			expect(channel.init).not.toHaveBeenCalled();
		});

		test('ignores duplicate shared channels', async () => {
			connection = createConnection(createUser());
			const channelService = createChannelService('main');
			channelService.shouldShare = true;
			channelsService.getChannelService.mockReturnValue(channelService);

			connection.connectChannel('conn1', {}, 'main');
			connection.connectChannel('conn2', {}, 'main');

			expect(channelService.create).toHaveBeenCalledTimes(1);
		});

		test('allows distinct non-shared channels', async () => {
			connection = createConnection(createUser());
			const channelService = createChannelService('main');
			channelService.shouldShare = false;
			channelsService.getChannelService.mockReturnValue(channelService);

			connection.connectChannel('conn1', {}, 'main');
			connection.connectChannel('conn2', {}, 'main');

			expect(channelService.create).toHaveBeenCalledTimes(2);
		});

		test('sends pong when requested', async () => {
			connection = createConnection(createUser());
			connection['wsConnection'] = wsConnection;
			const channel = createChannel('conn1', 'main');
			const channelService = createChannelService('main', () => channel);
			channelsService.getChannelService.mockReturnValue(channelService);

			connection.connectChannel('conn1', {}, 'main', true);

			expect(wsConnection.send).toHaveBeenCalledWith(JSON.stringify({ type: 'connected', body: { id: 'conn1' } }));
		});
	});

	describe('disconnectChannel', () => {
		test('disposes and removes matching channel', async () => {
			connection = createConnection(createUser());
			const channel = createChannel('conn1', 'main');
			const channelService = createChannelService('main', () => channel);
			channelsService.getChannelService.mockReturnValue(channelService);

			connection.connectChannel('conn1', {}, 'main');
			connection.disconnectChannel('conn1');

			expect(channel.dispose).toHaveBeenCalled();
		});

		test('does nothing for unknown id', async () => {
			connection = createConnection(createUser());
			connection.disconnectChannel('missing');

			expect(wsConnection.send).not.toHaveBeenCalled();
		});
	});

	describe('cacheNote', () => {
		test('caches note and limits cache size to 32', async () => {
			connection = createConnection();

			for (let i = 0; i < 35; i++) {
				connection.cacheNote({ id: `note${i}` } as never);
			}

			const cached = connection.cachedNotes;
			expect(cached.length).toBe(32);
			expect(cached[0].id).toBe('note34');
			expect(cached[cached.length - 1].id).toBe('note3');
		});

		test('updates existing cached note', async () => {
			connection = createConnection();
			connection.cacheNote({ id: 'note1', text: 'old' } as never);
			connection.cacheNote({ id: 'note1', text: 'new' } as never);

			expect(connection.cachedNotes).toHaveLength(1);
			expect(connection.cachedNotes[0].text).toBe('new');
		});

		test('caches reply and renote recursively', async () => {
			connection = createConnection();
			connection.cacheNote({
				id: 'note1',
				reply: { id: 'reply1' },
				renote: { id: 'renote1' },
			} as never);

			expect(connection.cachedNotes.map(n => n.id)).toContain('reply1');
			expect(connection.cachedNotes.map(n => n.id)).toContain('renote1');
		});
	});

	describe('sendMessageToWs', () => {
		test('serializes message and sends to websocket', async () => {
			connection = createConnection();
			connection['wsConnection'] = wsConnection;

			connection.sendMessageToWs('test', { foo: 'bar' });

			expect(wsConnection.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test', body: { foo: 'bar' } }));
		});
	});

	describe('dispose', () => {
		test('clears interval, disposes channels, removes listeners, and resets subscriptions', async () => {
			jest.useFakeTimers();
			connection = createConnection(createUser());
			cacheService.userProfileCache.fetch.mockResolvedValue({ userId: 'user1' } as never);
			cacheService.userFollowingsCache.fetch.mockResolvedValue(new Set());
			cacheService.userMutingsCache.fetch.mockResolvedValue(new Set());
			cacheService.userBlockedCache.fetch.mockResolvedValue(new Set());
			cacheService.renoteMutingsCache.fetch.mockResolvedValue(new Set());

			await connection.init();
			await connection.listen(subscriber as never, wsConnection);

			const channel = createChannel('conn1', 'main');
			const channelService = createChannelService('main', () => channel);
			channelsService.getChannelService.mockReturnValue(channelService);
			connection.connectChannel('conn1', {}, 'main');

			sendWsMessage({ type: 'subNote', body: { id: 'note1' } });

			connection.dispose();

			expect(channel.dispose).toHaveBeenCalled();
			expect(subscriber.listenerCount('broadcast')).toBe(0);
			expect(subscriber.listenerCount('noteStream:note1')).toBe(0);
			expect(wsConnection.off).toHaveBeenCalledWith('message', expect.any(Function));
		});
	});
});
