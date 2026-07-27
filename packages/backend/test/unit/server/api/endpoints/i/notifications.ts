process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import NotificationsEndpoint from '@/server/api/endpoints/i/notifications.js';
import { notificationTypes } from '@/types.js';
import type { UsersRepository, MutingsRepository, UserProfilesRepository, NotesRepository } from '@/models/index.js';
import type { IdService } from '@/core/IdService.js';
import type { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import type { NotificationService } from '@/core/NotificationService.js';
import type { QueryService } from '@/core/QueryService.js';
import type { NoteReadService } from '@/core/NoteReadService.js';
import type { LocalUser, User } from '@/models/entities/User.js';
import type { Notification } from '@/models/entities/Notification.js';
import type * as Redis from 'ioredis';

function createLocalUser(data: Partial<User> = {}): LocalUser {
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
		token: 'user-token',
		...data,
	} as unknown as LocalUser;
}

function createNotification(type: Notification['type'], data: Partial<Notification> = {}): Notification {
	return {
		id: 'notif1',
		createdAt: new Date().toISOString(),
		type,
		notifierId: type === 'follow' ? 'user2' : null,
		noteId: ['mention', 'reply', 'quote'].includes(type) ? 'note1' : null,
		...data,
	} as unknown as Notification;
}

describe('api:i/notifications', () => {
	function createEndpoint() {
		const redisClient = {
			xrevrange: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<Redis.Redis>;

		const usersRepository = {} as unknown as jest.Mocked<UsersRepository>;
		const mutingsRepository = {} as unknown as jest.Mocked<MutingsRepository>;
		const userProfilesRepository = {} as unknown as jest.Mocked<UserProfilesRepository>;

		const notesRepository = {
			findBy: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<NotesRepository>;

		const idService = {
			parse: jest.fn().mockImplementation((id: string) => ({ date: new Date(parseInt(id, 10)) })),
		} as unknown as jest.Mocked<IdService>;

		const notificationEntityService = {
			packMany: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<NotificationEntityService>;

		const notificationService = {
			readAllNotification: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<NotificationService>;

		const queryService = {} as unknown as jest.Mocked<QueryService>;

		const noteReadService = {
			read: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<NoteReadService>;

		const endpoint = new NotificationsEndpoint(
			redisClient,
			usersRepository,
			mutingsRepository,
			userProfilesRepository,
			notesRepository,
			idService,
			notificationEntityService,
			notificationService,
			queryService,
			noteReadService,
		);

		return {
			endpoint,
			redisClient,
			notesRepository,
			idService,
			notificationEntityService,
			notificationService,
			noteReadService,
		};
	}

	test('returns empty array when includeTypes is empty', async () => {
		const { endpoint, redisClient } = createEndpoint();
		const result = await endpoint.exec({ includeTypes: [] }, createLocalUser(), null);
		expect(result).toEqual([]);
		expect(redisClient.xrevrange).not.toHaveBeenCalled();
	});

	test('returns empty array when all notification types are excluded', async () => {
		const { endpoint, redisClient } = createEndpoint();
		const result = await endpoint.exec({ excludeTypes: notificationTypes }, createLocalUser(), null);
		expect(result).toEqual([]);
		expect(redisClient.xrevrange).not.toHaveBeenCalled();
	});

	test('queries redis with default limit', async () => {
		const { endpoint, redisClient } = createEndpoint();
		await endpoint.exec({}, createLocalUser(), null);
		expect(redisClient.xrevrange).toHaveBeenCalledWith('notificationTimeline:user1', '+', '-', 'COUNT', 10);
	});

	test('increases limit by one for untilId and parses it as timestamp', async () => {
		const { endpoint, redisClient, idService } = createEndpoint();
		await endpoint.exec({ limit: 5, untilId: '1234567890123' }, createLocalUser(), null);
		expect(idService.parse).toHaveBeenCalledWith('1234567890123');
		expect(redisClient.xrevrange).toHaveBeenCalledWith('notificationTimeline:user1', 1234567890123, '-', 'COUNT', 6);
	});

	test('increases limit by one for sinceId', async () => {
		const { endpoint, redisClient, idService } = createEndpoint();
		await endpoint.exec({ limit: 5, sinceId: '1234567890123' }, createLocalUser(), null);
		expect(idService.parse).toHaveBeenCalledWith('1234567890123');
		expect(redisClient.xrevrange).toHaveBeenCalledWith('notificationTimeline:user1', '+', 1234567890123, 'COUNT', 6);
	});

	test('returns empty array when redis returns no entries', async () => {
		const { endpoint, notificationEntityService } = createEndpoint();
		const result = await endpoint.exec({}, createLocalUser(), null);
		expect(result).toEqual([]);
		expect(notificationEntityService.packMany).not.toHaveBeenCalled();
	});

	test('filters out obsolete notification types from includeTypes and excludeTypes', async () => {
		const { endpoint, redisClient, notificationEntityService } = createEndpoint();
		redisClient.xrevrange.mockResolvedValueOnce([['id1', ['data', JSON.stringify(createNotification('follow'))]]]);
		notificationEntityService.packMany.mockResolvedValueOnce([{ id: 'notif1' }]);
		const result = await endpoint.exec({ includeTypes: ['follow', 'renote'], excludeTypes: ['mention', 'pollEnded'] }, createLocalUser(), null);
		expect(notificationEntityService.packMany).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ type: 'follow' })]), 'user1');
		expect(result).toEqual([{ id: 'notif1' }]);
	});

	test('filters by includeTypes', async () => {
		const { endpoint, redisClient, notificationEntityService } = createEndpoint();
		redisClient.xrevrange.mockResolvedValueOnce([
			['id1', ['data', JSON.stringify(createNotification('follow'))]],
			['id2', ['data', JSON.stringify(createNotification('mention'))]],
		]);
		notificationEntityService.packMany.mockResolvedValueOnce([{ id: 'notif2' }]);
		await endpoint.exec({ includeTypes: ['mention'] }, createLocalUser(), null);
		expect(notificationEntityService.packMany).toHaveBeenCalledWith([expect.objectContaining({ type: 'mention' })], 'user1');
	});

	test('filters by excludeTypes', async () => {
		const { endpoint, redisClient, notificationEntityService } = createEndpoint();
		redisClient.xrevrange.mockResolvedValueOnce([
			['id1', ['data', JSON.stringify(createNotification('follow'))]],
			['id2', ['data', JSON.stringify(createNotification('mention'))]],
		]);
		notificationEntityService.packMany.mockResolvedValueOnce([{ id: 'notif1' }]);
		await endpoint.exec({ excludeTypes: ['mention'] }, createLocalUser(), null);
		expect(notificationEntityService.packMany).toHaveBeenCalledWith([expect.objectContaining({ type: 'follow' })], 'user1');
	});

	test('returns empty array when all notifications are filtered out', async () => {
		const { endpoint, redisClient, notificationEntityService } = createEndpoint();
		redisClient.xrevrange.mockResolvedValueOnce([['id1', ['data', JSON.stringify(createNotification('follow'))]]]);
		const result = await endpoint.exec({ includeTypes: ['mention'] }, createLocalUser(), null);
		expect(result).toEqual([]);
		expect(notificationEntityService.packMany).not.toHaveBeenCalled();
	});

	test('marks notifications as read when markAsRead is true', async () => {
		const { endpoint, redisClient, notificationService } = createEndpoint();
		redisClient.xrevrange.mockResolvedValueOnce([['id1', ['data', JSON.stringify(createNotification('follow'))]]]);
		await endpoint.exec({ markAsRead: true }, createLocalUser(), null);
		expect(notificationService.readAllNotification).toHaveBeenCalledWith('user1');
	});

	test('does not mark notifications as read when markAsRead is false', async () => {
		const { endpoint, redisClient, notificationService } = createEndpoint();
		redisClient.xrevrange.mockResolvedValueOnce([['id1', ['data', JSON.stringify(createNotification('follow'))]]]);
		await endpoint.exec({ markAsRead: false }, createLocalUser(), null);
		expect(notificationService.readAllNotification).not.toHaveBeenCalled();
	});

	test('reads note notifications for mention, reply and quote', async () => {
		const { endpoint, redisClient, notesRepository, noteReadService } = createEndpoint();
		redisClient.xrevrange.mockResolvedValueOnce([
			['id1', ['data', JSON.stringify(createNotification('mention', { noteId: 'note1' }))]],
			['id2', ['data', JSON.stringify(createNotification('reply', { noteId: 'note2' }))]],
			['id3', ['data', JSON.stringify(createNotification('quote', { noteId: 'note3' }))]],
			['id4', ['data', JSON.stringify(createNotification('follow'))]],
		]);
		const notes = [{ id: 'note1' }, { id: 'note2' }, { id: 'note3' }];
		notesRepository.findBy.mockResolvedValueOnce(notes);
		await endpoint.exec({}, createLocalUser(), null);
		expect(notesRepository.findBy).toHaveBeenCalled();
		expect(noteReadService.read).toHaveBeenCalledWith('user1', notes);
	});

	test('returns packed notifications', async () => {
		const { endpoint, redisClient, notificationEntityService } = createEndpoint();
		redisClient.xrevrange.mockResolvedValueOnce([['id1', ['data', JSON.stringify(createNotification('follow'))]]]);
		notificationEntityService.packMany.mockResolvedValueOnce([{ id: 'packed1', type: 'follow' }]);
		const result = await endpoint.exec({}, createLocalUser(), null);
		expect(result).toEqual([{ id: 'packed1', type: 'follow' }]);
	});

	test('excludes the entry matching untilId from results', async () => {
		const { endpoint, redisClient, notificationEntityService } = createEndpoint();
		redisClient.xrevrange.mockResolvedValueOnce([
			['id1', ['data', JSON.stringify(createNotification('follow', { id: 'untilId' }))]],
			['id2', ['data', JSON.stringify(createNotification('follow', { id: 'notif2' }))]],
		]);
		notificationEntityService.packMany.mockResolvedValueOnce([{ id: 'notif2' }]);
		await endpoint.exec({ untilId: 'untilId' }, createLocalUser(), null);
		expect(notificationEntityService.packMany).toHaveBeenCalledWith([expect.objectContaining({ id: 'notif2' })], 'user1');
	});
});
