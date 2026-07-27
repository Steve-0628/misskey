process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import type { Config } from '@/config.js';
import type { AccessTokensRepository, FollowRequestsRepository, NoteReactionsRepository, NotesRepository, UsersRepository } from '@/models/index.js';
import type { ModuleRef } from '@nestjs/core';
import type { Notification } from '@/models/entities/Notification.js';
import type { User } from '@/models/entities/User.js';

function createService() {
	const config = {} as unknown as Config;

	const notesRepository = {
		find: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<NotesRepository>;

	const usersRepository = {
		find: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<UsersRepository>;

	const noteReactionsRepository = {} as unknown as jest.Mocked<NoteReactionsRepository>;

	const followRequestsRepository = {
		find: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<FollowRequestsRepository>;

	const accessTokensRepository = {
		findOneByOrFail: jest.fn().mockResolvedValue({ id: 'token1', name: 'App', iconUrl: 'https://example.com/icon.png' }),
	} as unknown as jest.Mocked<AccessTokensRepository>;

	const userEntityService = {
		pack: jest.fn().mockResolvedValue({ id: 'user1' }),
		packMany: jest.fn().mockResolvedValue([]),
	} as unknown as any;

	const noteEntityService = {
		pack: jest.fn().mockResolvedValue({ id: 'note1' }),
		packMany: jest.fn().mockResolvedValue([]),
	} as unknown as any;

	const customEmojiService = {} as unknown as any;

	const moduleRef = {
		get: jest.fn().mockImplementation(name => {
			if (name === 'UserEntityService') return userEntityService;
			if (name === 'NoteEntityService') return noteEntityService;
			if (name === 'CustomEmojiService') return customEmojiService;
			return undefined;
		}),
	} as unknown as ModuleRef;

	const service = new NotificationEntityService(
		moduleRef,
		notesRepository,
		usersRepository,
		noteReactionsRepository,
		followRequestsRepository,
		accessTokensRepository,
	);

	service.onModuleInit();

	return {
		service,
		mocks: {
			notesRepository,
			usersRepository,
			followRequestsRepository,
			accessTokensRepository,
			userEntityService,
			noteEntityService,
		},
	};
}

function createNotification(data: Partial<Notification> = {}): Notification {
	return {
		id: 'notif1',
		createdAt: new Date(),
		type: 'mention',
		notifierId: 'user1',
		notifieeId: 'me1',
		noteId: 'note1',
		...data,
	} as unknown as Notification;
}

describe('NotificationEntityService', () => {
	test('pack mention notification', async () => {
		const { service, mocks } = createService();
		mocks.noteEntityService.pack.mockResolvedValue({ id: 'note1' });
		mocks.userEntityService.pack.mockResolvedValue({ id: 'user1' });

		const result = await service.pack(createNotification(), 'me1', {});

		expect(result).toMatchObject({ id: 'notif1', type: 'mention', userId: 'user1', user: { id: 'user1' }, note: { id: 'note1' } });
	});

	test('pack reaction notification includes reaction', async () => {
		const { service } = createService();
		const result = await service.pack(createNotification({ type: 'reaction', reaction: '❤️' }), 'me1', {});
		expect(result).toMatchObject({ type: 'reaction', reaction: '❤️' });
	});

	test('pack achievementEarned notification includes achievement', async () => {
		const { service } = createService();
		const result = await service.pack(createNotification({ type: 'achievementEarned', achievement: 'test' }), 'me1', {});
		expect(result).toMatchObject({ type: 'achievementEarned', achievement: 'test' });
	});

	test('pack app notification uses token name/icon', async () => {
		const { service, mocks } = createService();
		mocks.accessTokensRepository.findOneByOrFail.mockResolvedValue({ id: 'token1', name: 'TestApp', iconUrl: 'https://example.com/icon.png' });
		const result = await service.pack(createNotification({ type: 'app', appAccessTokenId: 'token1' }), 'me1', {});
		expect(result).toMatchObject({ type: 'app', header: 'TestApp', icon: 'https://example.com/icon.png' });
	});

	test('pack app notification prefers custom header/icon', async () => {
		const { service } = createService();
		const result = await service.pack(createNotification({
			type: 'app',
			appAccessTokenId: 'token1',
			customHeader: 'Custom',
			customIcon: 'https://example.com/custom.png',
		}), 'me1', {});
		expect(result).toMatchObject({ type: 'app', header: 'Custom', icon: 'https://example.com/custom.png' });
	});

	test('pack uses hint maps when provided', async () => {
		const { service, mocks } = createService();
		const note = { id: 'note1' } as any;
		const user = { id: 'user1' } as any;

		const result = await service.pack(createNotification(), 'me1', {}, {
			packedNotes: new Map([['note1', note]]),
			packedUsers: new Map([['user1', user]]),
		});

		expect(result).toMatchObject({ user, note });
		expect(mocks.noteEntityService.pack).not.toHaveBeenCalled();
		expect(mocks.userEntityService.pack).not.toHaveBeenCalled();
	});

	test('packMany returns empty for empty input', async () => {
		const { service } = createService();
		const result = await service.packMany([], 'me1');
		expect(result).toEqual([]);
	});

	test('packMany filters out notifications with missing notes', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.find.mockResolvedValue([{ id: 'note1' }] as any);
		mocks.noteEntityService.packMany.mockResolvedValue([{ id: 'note1' }]);

		const result = await service.packMany([
			createNotification({ id: 'n1', noteId: 'note1' }),
			createNotification({ id: 'n2', noteId: 'missing' }),
		], 'me1');

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ id: 'n1' });
	});

	test('packMany filters out resolved follow requests', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.find.mockResolvedValue([{ id: 'note1' }] as any);
		mocks.noteEntityService.packMany.mockResolvedValue([{ id: 'note1' }]);
		mocks.followRequestsRepository.find.mockResolvedValue([{ followerId: 'user1' }] as any);

		const result = await service.packMany([
			createNotification({ id: 'n1', type: 'receiveFollowRequest', notifierId: 'user1' }),
			createNotification({ id: 'n2', type: 'receiveFollowRequest', notifierId: 'user2' }),
		], 'me1');

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ id: 'n1' });
	});

	test('pack follow notification does not include note', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.pack.mockResolvedValue({ id: 'user1' });

		const result = await service.pack(createNotification({ type: 'follow', noteId: null }), 'me1', {});

		expect(result).toMatchObject({ type: 'follow', userId: 'user1' });
		expect(result).not.toHaveProperty('note');
	});

	test('pack app notification uses token defaults', async () => {
		const { service, mocks } = createService();
		mocks.accessTokensRepository.findOneByOrFail.mockResolvedValue({ id: 'token1', name: 'DefaultApp', iconUrl: 'https://example.com/default.png' } as any);

		const result = await service.pack(createNotification({ type: 'app', appAccessTokenId: 'token1' }), 'me1', {});

		expect(result).toMatchObject({ type: 'app', header: 'DefaultApp', icon: 'https://example.com/default.png' });
	});

	test('pack notification without notifierId', async () => {
		const { service } = createService();

		const result = await service.pack(createNotification({ notifierId: null, type: 'pollEnded' }), 'me1', {});

		expect(result).toMatchObject({ type: 'pollEnded', userId: null });
		expect(result).not.toHaveProperty('user');
	});

	test('packMany packs notifications without notes even when user missing', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.find.mockResolvedValue([]);
		mocks.usersRepository.find.mockResolvedValue([{ id: 'user1' }] as any);
		mocks.userEntityService.packMany.mockResolvedValue([{ id: 'user1' }]);
		mocks.noteEntityService.packMany.mockResolvedValue([]);

		const result = await service.packMany([
			createNotification({ id: 'n1', notifierId: 'user1', noteId: null }),
			createNotification({ id: 'n2', notifierId: 'user2', noteId: null }),
		], 'me1');

		expect(result).toHaveLength(2);
	});

	test('packMany skips note fetch when no noteIds', async () => {
		const { service, mocks } = createService();
		mocks.usersRepository.find.mockResolvedValue([{ id: 'user1' }] as any);
		mocks.userEntityService.packMany.mockResolvedValue([{ id: 'user1' }]);

		const result = await service.packMany([createNotification({ id: 'n1', noteId: null })], 'me1');

		expect(mocks.notesRepository.find).not.toHaveBeenCalled();
		expect(result).toHaveLength(1);
	});
});
