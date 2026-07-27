process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { AdminChannelService } from '@/server/api/stream/channels/admin.js';
import type Connection from '@/server/api/stream/index.js';
import type { User } from '@/models/entities/User.js';

function createUser(partial: Partial<User> = {}): User {
	return {
		id: 'user1',
		...partial,
	} as unknown as User;
}

function createSubscriber() {
	return {
		on: jest.fn(),
		off: jest.fn(),
	} as unknown as Connection['subscriber'];
}

function createConnection(overrides: Partial<Connection> = {}): Connection {
	return {
		user: createUser(),
		userProfile: null,
		following: new Set(),
		userIdsWhoMeMuting: new Set(),
		userIdsWhoBlockingMe: new Set(),
		userIdsWhoMeMutingRenotes: new Set(),
		subscriber: createSubscriber(),
		sendMessageToWs: jest.fn(),
		...overrides,
	} as unknown as Connection;
}

function getHandler(subscriber: Connection['subscriber']) {
	return (subscriber.on as unknown as jest.Mock).mock.calls[0][1] as (data: any) => void;
}

describe('AdminChannel', () => {
	test('init subscribes to admin stream for the connected user', async () => {
		const connection = createConnection();
		const service = new AdminChannelService();
		const channel = service.create('channel1', connection);

		await channel.init({});

		expect(connection.subscriber.on).toHaveBeenCalledWith('adminStream:user1', expect.any(Function));
	});

	test('forwards admin stream events to the websocket connection', async () => {
		const connection = createConnection();
		const service = new AdminChannelService();
		const channel = service.create('channel1', connection);

		await channel.init({});
		const handler = getHandler(connection.subscriber);
		handler({ type: 'newAbuseUserReport', body: { id: 'report1', targetUserId: 'user2', reporterId: 'user3', comment: 'spam' } });

		expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
			id: 'channel1',
			type: 'newAbuseUserReport',
			body: { id: 'report1', targetUserId: 'user2', reporterId: 'user3', comment: 'spam' },
		});
	});

	test('dispose unsubscribes from admin stream', async () => {
		const connection = createConnection();
		const service = new AdminChannelService();
		const channel = service.create('channel1', connection);

		await channel.init({});
		channel.dispose!();

		expect(connection.subscriber.off).toHaveBeenCalledWith('adminStream:user1', expect.any(Function));
	});

	test('does not implement onMessage', async () => {
		const connection = createConnection();
		const service = new AdminChannelService();
		const channel = service.create('channel1', connection);

		expect(channel.onMessage).toBeUndefined();
	});
});
