process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import type { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import type { Config } from '@/config.js';
import type { EmojisRepository, Role } from '@/models/index.js';
import type { UtilityService } from '@/core/UtilityService.js';
import type { IdService } from '@/core/IdService.js';
import type { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import type { Emoji } from '@/models/entities/Emoji.js';

function createRedis(): jest.Mocked<Redis.Redis> {
	return {
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue('OK'),
		setex: jest.fn().mockResolvedValue('OK'),
		del: jest.fn().mockResolvedValue(1),
	} as unknown as jest.Mocked<Redis.Redis>;
}

function createService() {
	const redisClient = createRedis();
	const config = { host: 'example.com' } as unknown as Config;

	const emojisRepository = {
		insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'emoji1' }] }),
		findOneByOrFail: jest.fn().mockResolvedValue({ id: 'emoji1', name: 'foo' }),
		findOneBy: jest.fn().mockResolvedValue(null),
		findBy: jest.fn().mockResolvedValue([]),
		find: jest.fn().mockResolvedValue([]),
		update: jest.fn().mockResolvedValue(undefined),
		delete: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<EmojisRepository>;

	const db = {} as unknown as DataSource;

	const utilityService = {
		isSelfHost: jest.fn().mockImplementation((host: string) => host === config.host),
		toPunyNullable: jest.fn().mockImplementation((host: string | null) => host ?? null),
	} as unknown as jest.Mocked<UtilityService>;

	const idService = {
		genId: jest.fn().mockReturnValue('emoji1'),
	} as unknown as IdService;

	const emojiEntityService = {
		packDetailed: jest.fn().mockResolvedValue({ id: 'emoji1' }),
		packDetailedMany: jest.fn().mockResolvedValue([{ id: 'emoji1' }]),
	} as unknown as jest.Mocked<EmojiEntityService>;

	const globalEventService = {
		publishBroadcastStream: jest.fn(),
	} as unknown as GlobalEventService;

	const service = new CustomEmojiService(
		redisClient,
		config,
		db,
		emojisRepository,
		utilityService,
		idService,
		emojiEntityService,
		globalEventService,
	);

	return {
		service,
		mocks: {
			redisClient,
			emojisRepository,
			utilityService,
			idService,
			emojiEntityService,
			globalEventService,
		},
	};
}

function createDriveFile(data: Partial<DriveFile> = {}): DriveFile {
	return {
		id: 'file1',
		url: 'https://example.com/file1.png',
		...data,
	} as unknown as DriveFile;
}

describe('CustomEmojiService', () => {
	test('add inserts local emoji and broadcasts', async () => {
		const { service, mocks } = createService();
		const driveFile = createDriveFile();

		await service.add({
			driveFile,
			name: 'foo',
			category: 'cat',
			aliases: ['bar'],
			host: null,
			license: 'MIT',
			isSensitive: false,
			localOnly: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
		});

		expect(mocks.emojisRepository.insert).toHaveBeenCalled();
		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiAdded', { emoji: expect.any(Object) });
	});

	test('add remote emoji does not broadcast emojiAdded', async () => {
		const { service, mocks } = createService();
		const driveFile = createDriveFile();

		await service.add({
			driveFile,
			name: 'foo',
			category: null,
			aliases: [],
			host: 'remote.example',
			license: null,
			isSensitive: false,
			localOnly: false,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
		});

		expect(mocks.emojisRepository.insert).toHaveBeenCalled();
		expect(mocks.globalEventService.publishBroadcastStream).not.toHaveBeenCalled();
	});

	test('update throws when name already exists', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findOneBy.mockResolvedValueOnce({ id: 'emoji2', name: 'newname' } as Emoji);

		await expect(service.update('emoji1', { name: 'newname' })).rejects.toThrow('name already exists');
	});

	test('update broadcasts emojiUpdated when name unchanged', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findOneByOrFail.mockResolvedValue({ id: 'emoji1', name: 'foo' } as Emoji);

		await service.update('emoji1', { name: 'foo' });

		expect(mocks.emojisRepository.update).toHaveBeenCalledWith('emoji1', expect.any(Object));
		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiUpdated', { emojis: expect.any(Array) });
	});

	test('update broadcasts emojiDeleted and emojiAdded when name changed', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findOneByOrFail.mockResolvedValue({ id: 'emoji1', name: 'old' } as Emoji);

		await service.update('emoji1', { name: 'new' });

		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiDeleted', { emojis: expect.any(Array) });
		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiAdded', { emoji: expect.any(Object) });
	});

	test('addAliasesBulk updates aliases and broadcasts', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findBy.mockResolvedValue([{ id: 'emoji1', aliases: ['a'] }] as Emoji[]);

		await service.addAliasesBulk(['emoji1'], ['b']);

		expect(mocks.emojisRepository.update).toHaveBeenCalledWith('emoji1', expect.objectContaining({ aliases: ['a', 'b'] }));
		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiUpdated', { emojis: expect.any(Array) });
	});

	test('removeAliasesBulk filters aliases and broadcasts', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findBy.mockResolvedValue([{ id: 'emoji1', aliases: ['a', 'b'] }] as Emoji[]);

		await service.removeAliasesBulk(['emoji1'], ['a']);

		expect(mocks.emojisRepository.update).toHaveBeenCalledWith('emoji1', expect.objectContaining({ aliases: ['b'] }));
	});

	test('delete removes emoji and broadcasts', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findOneByOrFail.mockResolvedValue({ id: 'emoji1', name: 'foo' } as Emoji);

		await service.delete('emoji1');

		expect(mocks.emojisRepository.delete).toHaveBeenCalledWith('emoji1');
		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiDeleted', { emojis: expect.any(Array) });
	});

	test('deleteBulk removes emojis and broadcasts', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findBy.mockResolvedValue([{ id: 'emoji1' }, { id: 'emoji2' }] as Emoji[]);

		await service.deleteBulk(['emoji1', 'emoji2']);

		expect(mocks.emojisRepository.delete).toHaveBeenCalledTimes(2);
		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiDeleted', { emojis: expect.any(Array) });
	});

	describe('parseEmojiStr', () => {
		test('parses local emoji', () => {
			const { service } = createService();
			expect(service.parseEmojiStr('foo@.', null)).toEqual({ name: 'foo', host: null });
		});

		test('parses remote emoji', () => {
			const { service, mocks } = createService();
			mocks.utilityService.toPunyNullable.mockReturnValue('remote.example');
			expect(service.parseEmojiStr('foo@remote.example', null)).toEqual({ name: 'foo', host: 'remote.example' });
		});

		test('uses noteUserHost when host omitted', () => {
			const { service, mocks } = createService();
			mocks.utilityService.toPunyNullable.mockImplementation((h: string | null) => h);
			expect(service.parseEmojiStr('foo', 'remote.example')).toEqual({ name: 'foo', host: 'remote.example' });
		});

		test('returns null for invalid format', () => {
			const { service } = createService();
			expect(service.parseEmojiStr('🎉', null)).toEqual({ name: null, host: null });
		});

		test('self host resolves to null', () => {
			const { service } = createService();
			expect(service.parseEmojiStr('foo@example.com', null)).toEqual({ name: 'foo', host: null });
		});
	});

	test('populateEmoji returns publicUrl when matched', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findOneBy.mockResolvedValue({ name: 'foo', host: 'remote.example', publicUrl: 'https://cdn.example.com/foo.png', originalUrl: 'https://example.com/foo.png' } as Emoji);

		const url = await service.populateEmoji('foo@remote.example', null);

		expect(url).toBe('https://cdn.example.com/foo.png');
	});

	test('populateEmoji returns null when not matched', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findOneBy.mockResolvedValue(null);

		const url = await service.populateEmoji('foo@remote.example', null);

		expect(url).toBeNull();
	});

	test('populateEmojis returns only matched entries', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findOneBy.mockResolvedValueOnce({ name: 'foo', host: 'remote.example', publicUrl: 'url1', originalUrl: '' } as Emoji);
		mocks.emojisRepository.findOneBy.mockResolvedValueOnce(null);

		const result = await service.populateEmojis(['foo@remote.example', 'bar@remote.example'], null);

		expect(result).toEqual({ 'foo@remote.example': 'url1' });
	});

	test('prefetchEmojis caches found emojis', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.find.mockResolvedValue([
			{ name: 'foo', host: 'remote.example', originalUrl: 'url1', publicUrl: 'url1' },
		] as Emoji[]);

		await service.prefetchEmojis([{ name: 'foo', host: 'remote.example' }]);

		expect(mocks.emojisRepository.find).toHaveBeenCalled();
	});

	test('dispose does not throw', () => {
		const { service } = createService();
		expect(() => service.dispose()).not.toThrow();
		expect(() => service.onApplicationShutdown()).not.toThrow();
	});

	test('setAliasesBulk replaces aliases and broadcasts', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findBy.mockResolvedValue([{ id: 'emoji1', name: 'foo' }] as Emoji[]);

		await service.setAliasesBulk(['emoji1'], ['a', 'b']);

		expect(mocks.emojisRepository.update).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(Object) }), expect.objectContaining({ aliases: ['a', 'b'] }));
		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiUpdated', { emojis: expect.any(Array) });
	});

	test('setCategoryBulk updates category and broadcasts', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findBy.mockResolvedValue([{ id: 'emoji1', name: 'foo' }] as Emoji[]);

		await service.setCategoryBulk(['emoji1'], 'newcat');

		expect(mocks.emojisRepository.update).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(Object) }), expect.objectContaining({ category: 'newcat' }));
		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiUpdated', { emojis: expect.any(Array) });
	});

	test('setLicenseBulk updates license and broadcasts', async () => {
		const { service, mocks } = createService();
		mocks.emojisRepository.findBy.mockResolvedValue([{ id: 'emoji1', name: 'foo' }] as Emoji[]);

		await service.setLicenseBulk(['emoji1'], 'GPL');

		expect(mocks.emojisRepository.update).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(Object) }), expect.objectContaining({ license: 'GPL' }));
		expect(mocks.globalEventService.publishBroadcastStream).toHaveBeenCalledWith('emojiUpdated', { emojis: expect.any(Array) });
	});

	test('populateEmoji returns null for local emoji', async () => {
		const { service } = createService();

		const url = await service.populateEmoji('foo', null);

		expect(url).toBeNull();
	});

	test('prefetchEmojis skips already cached emojis', async () => {
		const { service, mocks } = createService();
		mocks.redisClient.get.mockResolvedValue('cached');

		await service.prefetchEmojis([{ name: 'foo', host: null }]);

		expect(mocks.emojisRepository.find).not.toHaveBeenCalled();
	});

	test('parseEmojiStr returns null host when noteUserHost is undefined input', () => {
		const { service } = createService();
		expect(service.parseEmojiStr('foo', null)).toEqual({ name: 'foo', host: null });
	});
});
