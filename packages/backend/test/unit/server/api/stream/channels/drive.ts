process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { DriveChannelService } from '@/server/api/stream/channels/drive.js';
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

describe('DriveChannel', () => {
	test('init subscribes to drive stream for the connected user', async () => {
		const connection = createConnection();
		const service = new DriveChannelService();
		const channel = service.create('channel1', connection);

		await channel.init({});

		expect(connection.subscriber.on).toHaveBeenCalledWith('driveStream:user1', expect.any(Function));
	});

	test('forwards drive stream events to the websocket connection', async () => {
		const connection = createConnection();
		const service = new DriveChannelService();
		const channel = service.create('channel1', connection);

		await channel.init({});
		const handler = getHandler(connection.subscriber);
		handler({ type: 'fileCreated', body: { id: 'file1', name: 'test.png' } });

		expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
			id: 'channel1',
			type: 'fileCreated',
			body: { id: 'file1', name: 'test.png' },
		});
	});

	test('dispose unsubscribes from drive stream', async () => {
		const connection = createConnection();
		const service = new DriveChannelService();
		const channel = service.create('channel1', connection);

		await channel.init({});
		channel.dispose!();

		expect(connection.subscriber.off).toHaveBeenCalledWith('driveStream:user1', expect.any(Function));
	});

	test('does not implement onMessage', async () => {
		const connection = createConnection();
		const service = new DriveChannelService();
		const channel = service.create('channel1', connection);

		expect(channel.onMessage).toBeUndefined();
	});
});
