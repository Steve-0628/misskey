process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { EventEmitter } from 'events';
import { HashtagChannelService } from '@/server/api/stream/channels/hashtag.js';
import type Connection from '@/server/api/stream/index.js';
import type { User } from '@/models/entities/User.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { Packed } from '@/misc/json-schema.js';

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
		cacheNote: jest.fn(),
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

describe('HashtagChannel', () => {
	function setup() {
		const connection = createConnection();
		const noteEntityService = {
			pack: jest.fn(),
		} as unknown as jest.Mocked<NoteEntityService>;
		const service = new HashtagChannelService(noteEntityService);
		const channel = service.create('channel1', connection);
		return { connection, noteEntityService, service, channel };
	}

	test('init subscribes to notesStream when q is provided', async () => {
		const { connection, channel } = setup();

		await channel.init({ q: [['hashtag']] });

		expect(connection.subscriber.listenerCount('notesStream')).toBe(1);
	});

	test('init does not subscribe when q is null', async () => {
		const { connection, channel } = setup();

		await channel.init({ q: null });

		expect(connection.subscriber.listenerCount('notesStream')).toBe(0);
	});

	test('dispose unsubscribes from notesStream', async () => {
		const { connection, channel } = setup();

		await channel.init({ q: [['hashtag']] });
		expect(connection.subscriber.listenerCount('notesStream')).toBe(1);

		channel.dispose!();

		expect(connection.subscriber.listenerCount('notesStream')).toBe(0);
	});

	test('sends note when tags match query', async () => {
		const { connection, channel } = setup();

		await channel.init({ q: [['hashtag']] });
		const note = createPackedNote({ tags: ['hashtag'] });
		(connection.subscriber as unknown as EventEmitter).emit('notesStream', note);

		expect(connection.cacheNote).toHaveBeenCalledWith(note);
		expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
			id: 'channel1',
			type: 'note',
			body: note,
		});
	});

	test('matches tags case-insensitively and normalizes query tags', async () => {
		const { connection, channel } = setup();

		await channel.init({ q: [['Hashtag']] });
		const note = createPackedNote({ tags: ['HASHTAG'] });
		(connection.subscriber as unknown as EventEmitter).emit('notesStream', note);

		expect(connection.sendMessageToWs).toHaveBeenCalled();
	});

	test('does not send note when no tag matches', async () => {
		const { connection, channel } = setup();

		await channel.init({ q: [['hashtag']] });
		const note = createPackedNote({ tags: ['other'] });
		(connection.subscriber as unknown as EventEmitter).emit('notesStream', note);

		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('requires all tags in a query group to match', async () => {
		const { connection, channel } = setup();

		await channel.init({ q: [['foo', 'bar']] });
		const noteWithBoth = createPackedNote({ tags: ['foo', 'bar'] });
		const noteWithOne = createPackedNote({ tags: ['foo'] });

		(connection.subscriber as unknown as EventEmitter).emit('notesStream', noteWithBoth);
		expect(connection.sendMessageToWs).toHaveBeenCalledTimes(1);

		(connection.subscriber as unknown as EventEmitter).emit('notesStream', noteWithOne);
		expect(connection.sendMessageToWs).toHaveBeenCalledTimes(1);
	});

	test('matches when any query group matches', async () => {
		const { connection, channel } = setup();

		await channel.init({ q: [['foo'], ['bar']] });
		const note = createPackedNote({ tags: ['bar'] });
		(connection.subscriber as unknown as EventEmitter).emit('notesStream', note);

		expect(connection.sendMessageToWs).toHaveBeenCalledTimes(1);
	});

	test('repacks renote when renoteId is present', async () => {
		const { connection, noteEntityService, channel } = setup();
		const renote = createPackedNote({ id: 'renote1', text: 'original' });
		noteEntityService.pack.mockResolvedValue(renote);

		await channel.init({ q: [['hashtag']] });
		const note = createPackedNote({ tags: ['hashtag'], renoteId: 'renote1' });
		(connection.subscriber as unknown as EventEmitter).emit('notesStream', note);
		await new Promise(resolve => setImmediate(resolve));

		expect(noteEntityService.pack).toHaveBeenCalledWith('renote1', connection.user, { detail: true });
		expect(connection.sendMessageToWs).toHaveBeenCalled();
	});

	test('filters note from muted user', async () => {
		const connection = createConnection({ userIdsWhoMeMuting: new Set(['baduser1']) });
		const noteEntityService = { pack: jest.fn() } as unknown as jest.Mocked<NoteEntityService>;
		const service = new HashtagChannelService(noteEntityService);
		const channel = service.create('channel1', connection);

		await channel.init({ q: [['hashtag']] });
		const note = createPackedNote({ tags: ['hashtag'], userId: 'baduser1' });
		(connection.subscriber as unknown as EventEmitter).emit('notesStream', note);

		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('filters note from blocking user', async () => {
		const connection = createConnection({ userIdsWhoBlockingMe: new Set(['baduser1']) });
		const noteEntityService = { pack: jest.fn() } as unknown as jest.Mocked<NoteEntityService>;
		const service = new HashtagChannelService(noteEntityService);
		const channel = service.create('channel1', connection);

		await channel.init({ q: [['hashtag']] });
		const note = createPackedNote({ tags: ['hashtag'], userId: 'baduser1' });
		(connection.subscriber as unknown as EventEmitter).emit('notesStream', note);

		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('filters pure renote from muted renote user', async () => {
		const connection = createConnection({ userIdsWhoMeMutingRenotes: new Set(['baduser1']) });
		const noteEntityService = {
			pack: jest.fn().mockResolvedValue(createPackedNote({ id: 'renote1', userId: 'baduser1', text: null })),
		} as unknown as jest.Mocked<NoteEntityService>;
		const service = new HashtagChannelService(noteEntityService);
		const channel = service.create('channel1', connection);

		await channel.init({ q: [['hashtag']] });
		const note = createPackedNote({ tags: ['hashtag'], renoteId: 'renote1', text: null });
		(connection.subscriber as unknown as EventEmitter).emit('notesStream', note);
		await new Promise(resolve => setImmediate(resolve));

		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('does not implement onMessage', async () => {
		const { channel } = setup();

		expect(channel.onMessage).toBeUndefined();
	});
});
