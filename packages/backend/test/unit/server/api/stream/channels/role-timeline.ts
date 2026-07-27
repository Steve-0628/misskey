process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { RoleTimelineChannelService } from '@/server/api/stream/channels/role-timeline.js';
import type Connection from '@/server/api/stream/index.js';
import type { User } from '@/models/entities/User.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { RoleService } from '@/core/RoleService.js';
import type { Packed } from '@/misc/json-schema.js';

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

function createPackedNote(partial: Partial<Packed<'Note'>> = {}): Packed<'Note'> {
	return {
		id: 'note1',
		createdAt: new Date().toISOString(),
		text: 'hello',
		userId: 'user1',
		user: { id: 'user1' } as unknown as Packed<'User'>,
		visibility: 'public',
		reactionAcceptance: null,
		reactions: {},
		renoteCount: 0,
		repliesCount: 0,
		...partial,
	} as unknown as Packed<'Note'>;
}

function getHandler(subscriber: Connection['subscriber']) {
	return (subscriber.on as unknown as jest.Mock).mock.calls[0][1] as (data: any) => Promise<void>;
}

describe('RoleTimelineChannel', () => {
	function setup() {
		const connection = createConnection();
		const noteEntityService = {} as unknown as NoteEntityService;
		const roleService = {
			isExplorable: jest.fn(),
		} as unknown as RoleService;
		const service = new RoleTimelineChannelService(noteEntityService, roleService);
		const channel = service.create('channel1', connection);
		return { connection, noteEntityService, roleService, service, channel };
	}

	test('init subscribes to role timeline stream with provided roleId', async () => {
		const { connection, channel } = setup();

		await channel.init({ roleId: 'role1' });

		expect(connection.subscriber.on).toHaveBeenCalledWith('roleTimelineStream:role1', expect.any(Function));
	});

	test('does not send note when role is not explorable', async () => {
		const { connection, roleService, channel } = setup();
		(roleService.isExplorable as unknown as jest.Mock).mockResolvedValue(false);

		await channel.init({ roleId: 'role1' });
		const handler = getHandler(connection.subscriber);
		await handler({ type: 'note', body: createPackedNote() });

		expect(roleService.isExplorable).toHaveBeenCalledWith({ id: 'role1' });
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('does not send non-public notes', async () => {
		const { connection, roleService, channel } = setup();
		(roleService.isExplorable as unknown as jest.Mock).mockResolvedValue(true);

		await channel.init({ roleId: 'role1' });
		const handler = getHandler(connection.subscriber);
		await handler({ type: 'note', body: createPackedNote({ visibility: 'followers' }) });

		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('does not send notes from muted users', async () => {
		const connection = createConnection({
			userIdsWhoMeMuting: new Set(['user2']),
		});
		const roleService = { isExplorable: jest.fn() } as unknown as RoleService;
		const service = new RoleTimelineChannelService({} as unknown as NoteEntityService, roleService);
		const channel = service.create('channel1', connection);
		(roleService.isExplorable as unknown as jest.Mock).mockResolvedValue(true);

		await channel.init({ roleId: 'role1' });
		const handler = getHandler(connection.subscriber);
		await handler({ type: 'note', body: createPackedNote({ userId: 'user2' }) });

		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('does not send notes from blocking users', async () => {
		const connection = createConnection({
			userIdsWhoBlockingMe: new Set(['user2']),
		});
		const roleService = { isExplorable: jest.fn() } as unknown as RoleService;
		const service = new RoleTimelineChannelService({} as unknown as NoteEntityService, roleService);
		const channel = service.create('channel1', connection);
		(roleService.isExplorable as unknown as jest.Mock).mockResolvedValue(true);

		await channel.init({ roleId: 'role1' });
		const handler = getHandler(connection.subscriber);
		await handler({ type: 'note', body: createPackedNote({ userId: 'user2' }) });

		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('does not send renotes from users whose renotes are muted', async () => {
		const connection = createConnection({
			userIdsWhoMeMutingRenotes: new Set(['user2']),
		});
		const roleService = { isExplorable: jest.fn() } as unknown as RoleService;
		const service = new RoleTimelineChannelService({} as unknown as NoteEntityService, roleService);
		const channel = service.create('channel1', connection);
		(roleService.isExplorable as unknown as jest.Mock).mockResolvedValue(true);

		await channel.init({ roleId: 'role1' });
		const handler = getHandler(connection.subscriber);
		await handler({
			type: 'note',
			body: createPackedNote({
				text: null,
				renote: createPackedNote({ id: 'renote1', userId: 'user2' }),
			}),
		});

		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('sends public note when all filters pass', async () => {
		const { connection, roleService, channel } = setup();
		(roleService.isExplorable as unknown as jest.Mock).mockResolvedValue(true);

		await channel.init({ roleId: 'role1' });
		const handler = getHandler(connection.subscriber);
		const note = createPackedNote();
		await handler({ type: 'note', body: note });

		expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
			id: 'channel1',
			type: 'note',
			body: note,
		});
	});

	test('forwards non-note events with their type and body', async () => {
		const { connection, roleService, channel } = setup();
		(roleService.isExplorable as unknown as jest.Mock).mockResolvedValue(true);

		await channel.init({ roleId: 'role1' });
		const handler = getHandler(connection.subscriber);
		await handler({ type: 'customEvent', body: { foo: 'bar' } });

		expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
			id: 'channel1',
			type: 'customEvent',
			body: { foo: 'bar' },
		});
	});

	test('dispose unsubscribes from role timeline stream', async () => {
		const { connection, channel } = setup();

		await channel.init({ roleId: 'role1' });
		channel.dispose!();

		expect(connection.subscriber.off).toHaveBeenCalledWith('roleTimelineStream:role1', expect.any(Function));
	});

	test('does not implement onMessage', async () => {
		const { channel } = setup();

		expect(channel.onMessage).toBeUndefined();
	});
});
