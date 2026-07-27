process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';
import type Connection from '@/server/api/stream/index.js';
import type { User } from '@/models/entities/User.js';

const xevSingleton = new EventEmitter();

jest.unstable_mockModule('xev', () => {
	class MockXev extends EventEmitter {
		constructor() {
			super();
			return xevSingleton as unknown as MockXev;
		}
	}

	return {
		default: MockXev,
	};
});

const { QueueStatsChannelService } = await import('@/server/api/stream/channels/queue-stats.js');

function createUser(partial: Partial<User> = {}): User {
	return {
		id: 'user1',
		...partial,
	} as unknown as User;
}

function createConnection(overrides: Partial<Connection> = {}): Connection {
	return {
		user: createUser(),
		userProfile: null,
		following: new Set(),
		userIdsWhoMeMuting: new Set(),
		userIdsWhoBlockingMe: new Set(),
		userIdsWhoMeMutingRenotes: new Set(),
		subscriber: new EventEmitter() as unknown as Connection['subscriber'],
		sendMessageToWs: jest.fn(),
		...overrides,
	} as unknown as Connection;
}

describe('QueueStatsChannel', () => {
	beforeEach(() => {
		xevSingleton.removeAllListeners();
		jest.clearAllMocks();
	});

	test('init subscribes to queueStats event', async () => {
		const connection = createConnection();
		const service = new QueueStatsChannelService();
		const channel = service.create('channel1', connection);

		await channel.init({});

		expect(xevSingleton.listenerCount('queueStats')).toBe(1);
	});

	test('forwards queueStats events to the websocket connection', async () => {
		const connection = createConnection();
		const service = new QueueStatsChannelService();
		const channel = service.create('channel1', connection);

		await channel.init({});
		xevSingleton.emit('queueStats', { queued: 5 });

		expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
			id: 'channel1',
			type: 'stats',
			body: { queued: 5 },
		});
	});

	test('onMessage requestLog registers once listener and emits requestQueueStatsLog', async () => {
		const connection = createConnection();
		const service = new QueueStatsChannelService();
		const channel = service.create('channel1', connection);

		channel.onMessage!('requestLog', { id: 'log1', length: 10 });

		expect(xevSingleton.listenerCount('queueStatsLog:log1')).toBe(1);
		xevSingleton.emit('queueStatsLog:log1', { entries: ['a', 'b'] });

		expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
			id: 'channel1',
			type: 'statsLog',
			body: { entries: ['a', 'b'] },
		});
	});

	test('onMessage requestLog passes id and length to requestQueueStatsLog', async () => {
		const service = new QueueStatsChannelService();
		const channel = service.create('channel1', createConnection());
		const emitSpy = jest.spyOn(xevSingleton, 'emit');

		channel.onMessage!('requestLog', { id: 'log2', length: 20 });

		expect(emitSpy).toHaveBeenCalledWith('requestQueueStatsLog', {
			id: 'log2',
			length: 20,
		});
	});

	test('onMessage with unknown type does nothing', async () => {
		const connection = createConnection();
		const service = new QueueStatsChannelService();
		const channel = service.create('channel1', connection);
		const emitSpy = jest.spyOn(xevSingleton, 'emit');

		channel.onMessage!('unknownType', { foo: 'bar' });

		expect(emitSpy).not.toHaveBeenCalled();
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('dispose unsubscribes from queueStats event', async () => {
		const connection = createConnection();
		const service = new QueueStatsChannelService();
		const channel = service.create('channel1', connection);

		await channel.init({});
		expect(xevSingleton.listenerCount('queueStats')).toBe(1);

		channel.dispose!();

		expect(xevSingleton.listenerCount('queueStats')).toBe(0);
	});
});
