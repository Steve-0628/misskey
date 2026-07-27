process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { VideoProcessingService } from '@/core/VideoProcessingService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { DI } from '@/di-symbols.js';
import type { DriveFilesRepository, NotesRepository } from '@/models/index.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import type { Packed } from '@/misc/json-schema.js';
import type { TestingModule } from '@nestjs/testing';

function createDriveFile(data: Partial<DriveFile> = {}): DriveFile {
	return {
		id: 'file1',
		createdAt: new Date('2023-01-01T00:00:00.000Z'),
		userId: 'user1',
		userHost: null,
		md5: 'd41d8cd98f00b204e9800998ecf8427e',
		name: 'test.png',
		type: 'image/png',
		size: 1024,
		comment: null,
		blurhash: null,
		properties: { width: 100, height: 100 },
		storedInternal: true,
		url: 'https://example.com/files/file1',
		thumbnailUrl: 'https://example.com/files/file1-thumbnail',
		webpublicUrl: 'https://example.com/files/file1-webpublic',
		webpublicType: 'image/png',
		accessKey: 'access1',
		thumbnailAccessKey: 'thumbaccess1',
		webpublicAccessKey: 'webpublic1',
		uri: null,
		src: null,
		folderId: null,
		folder: null,
		isSensitive: false,
		isLink: false,
		requestHeaders: null,
		requestIp: null,
		...data,
	} as DriveFile;
}

function createQueryBuilderMock(result: unknown) {
	return jest.fn().mockReturnValue({
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		select: jest.fn().mockReturnThis(),
		getRawOne: jest.fn().mockResolvedValue(result),
	});
}

describe('DriveFileEntityService', () => {
	let app: TestingModule;
	let service: DriveFileEntityService;
	let driveFilesRepository: jest.Mocked<DriveFilesRepository>;
	let userEntityService: jest.Mocked<UserEntityService>;
	let driveFolderEntityService: jest.Mocked<DriveFolderEntityService>;
	let videoProcessingService: jest.Mocked<VideoProcessingService>;
	let utilityService: jest.Mocked<UtilityService>;

	beforeEach(async () => {
		driveFilesRepository = {
			findOneByOrFail: jest.fn(),
			findOneBy: jest.fn(),
			findBy: jest.fn(),
			createQueryBuilder: createQueryBuilderMock({ sum: '1024' }),
			decrement: jest.fn(),
		} as unknown as jest.Mocked<DriveFilesRepository>;

		userEntityService = {
			pack: jest.fn().mockResolvedValue({ id: 'user1' } as unknown as Packed<'UserLite'>),
		} as unknown as jest.Mocked<UserEntityService>;

		driveFolderEntityService = {
			pack: jest.fn().mockResolvedValue({ id: 'folder1' } as unknown as Packed<'DriveFolder'>),
		} as unknown as jest.Mocked<DriveFolderEntityService>;

		videoProcessingService = {
			getExternalVideoThumbnailUrl: jest.fn().mockReturnValue('https://example.com/video-thumb'),
		} as unknown as jest.Mocked<VideoProcessingService>;

		utilityService = {
			toPuny: jest.fn((host) => host),
		} as unknown as jest.Mocked<UtilityService>;

		const notesRepository = {} as unknown as jest.Mocked<NotesRepository>;

		const config = {
			url: 'https://example.com',
			mediaProxy: 'https://example.com/proxy',
			externalMediaProxyEnabled: false,
			proxyRemoteFiles: false,
		};

		const db = {} as unknown as DataSource;

		app = await Test.createTestingModule({
			providers: [
				DriveFileEntityService,
				{ provide: DI.config, useValue: config },
				{ provide: DI.db, useValue: db },
				{ provide: DI.notesRepository, useValue: notesRepository },
				{ provide: DI.driveFilesRepository, useValue: driveFilesRepository },
				{ provide: UserEntityService, useValue: userEntityService },
				{ provide: DriveFolderEntityService, useValue: driveFolderEntityService },
				{ provide: VideoProcessingService, useValue: videoProcessingService },
				{ provide: UtilityService, useValue: utilityService },
			],
		}).compile();

		service = app.get<DriveFileEntityService>(DriveFileEntityService);
	});

	afterEach(async () => {
		await app.close();
	});

	describe('validateFileName', () => {
		test('accepts valid file name', () => {
			expect(service.validateFileName('valid.png')).toBe(true);
		});

		test('rejects empty name', () => {
			expect(service.validateFileName('')).toBe(false);
		});

		test('rejects name with backslash', () => {
			expect(service.validateFileName('a\\b.png')).toBe(false);
		});

		test('rejects name with slash', () => {
			expect(service.validateFileName('a/b.png')).toBe(false);
		});

		test('rejects name with double dots', () => {
			expect(service.validateFileName('a..b.png')).toBe(false);
		});

		test('rejects overly long name', () => {
			expect(service.validateFileName('a'.repeat(201))).toBe(false);
		});
	});

	describe('getPublicProperties', () => {
		test('swaps width and height when orientation >= 5', () => {
			const file = createDriveFile({ properties: { width: 100, height: 200, orientation: 6 } });
			expect(service.getPublicProperties(file)).toEqual({ width: 200, height: 100 });
		});

		test('returns properties as-is when orientation < 5', () => {
			const file = createDriveFile({ properties: { width: 100, height: 200, orientation: 1 } });
			expect(service.getPublicProperties(file)).toEqual({ width: 100, height: 200, orientation: undefined });
		});

		test('returns properties when no orientation', () => {
			const file = createDriveFile({ properties: { width: 100, height: 200 } });
			expect(service.getPublicProperties(file)).toEqual({ width: 100, height: 200 });
		});
	});

	describe('getThumbnailUrl', () => {
		test('returns video thumbnail for video file', () => {
			const file = createDriveFile({ type: 'video/mp4', thumbnailUrl: null, webpublicUrl: 'https://example.com/video.webm', url: 'https://example.com/video.mp4' });
			expect(service.getThumbnailUrl(file)).toBe('https://example.com/video-thumb');
		});

		test('returns existing thumbnail for video file when available', () => {
			const file = createDriveFile({ type: 'video/mp4', thumbnailUrl: 'https://example.com/custom-thumb' });
			expect(service.getThumbnailUrl(file)).toBe('https://example.com/custom-thumb');
		});

		test('uses external media proxy for remote file when enabled', () => {
			const config = app.get(DI.config);
			config.externalMediaProxyEnabled = true;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', type: 'image/png' });
			expect(service.getThumbnailUrl(file)).toBe('https://example.com/proxy/static.webp?url=https%3A%2F%2Fremote.example%2Ffile.png&static=1');
		});

		test('uses media proxy for remote link when proxyRemoteFiles enabled', () => {
			const config = app.get(DI.config);
			config.proxyRemoteFiles = true;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: true, type: 'image/png' });
			expect(service.getThumbnailUrl(file)).toBe('https://example.com/proxy/static.webp?url=https%3A%2F%2Fremote.example%2Ffile.png&static=1');
		});

		test('returns thumbnailUrl for image when available', () => {
			const file = createDriveFile({ type: 'image/png', thumbnailUrl: 'https://example.com/thumb.png' });
			expect(service.getThumbnailUrl(file)).toBe('https://example.com/thumb.png');
		});

		test('returns null for non-convertible image without thumbnail', () => {
			const file = createDriveFile({ type: 'image/bmp', thumbnailUrl: null, webpublicUrl: null, url: 'https://example.com/file.bmp' });
			expect(service.getThumbnailUrl(file)).toBeNull();
		});

		test('returns webpublicUrl for convertible image without thumbnailUrl', () => {
			const file = createDriveFile({ type: 'image/png', thumbnailUrl: null, webpublicUrl: 'https://example.com/files/file1-webpublic' });
			expect(service.getThumbnailUrl(file)).toBe('https://example.com/files/file1-webpublic');
		});

		test('returns webpublicUrl for remote non-link without proxy', () => {
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: false, thumbnailUrl: null });
			expect(service.getThumbnailUrl(file)).toBe('https://example.com/files/file1-webpublic');
		});

		test('uses video webpublicUrl when thumbnailUrl missing', () => {
			const file = createDriveFile({ type: 'video/mp4', thumbnailUrl: null, webpublicUrl: 'https://example.com/video.webm', url: 'https://example.com/video.mp4' });
			expect(service.getThumbnailUrl(file)).toBe('https://example.com/video-thumb');
		});
	});

	describe('getPublicUrl', () => {
		test('returns webpublicUrl for local file', () => {
			const file = createDriveFile();
			expect(service.getPublicUrl(file)).toBe('https://example.com/files/file1-webpublic');
		});

		test('uses external media proxy for remote file when enabled', () => {
			const config = app.get(DI.config);
			config.externalMediaProxyEnabled = true;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example' });
			expect(service.getPublicUrl(file)).toBe('https://example.com/proxy/image.webp?url=https%3A%2F%2Fremote.example%2Ffile.png');
		});

		test('uses local proxy for remote link with valid webpublicAccessKey', () => {
			const config = app.get(DI.config);
			config.proxyRemoteFiles = true;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: true, webpublicAccessKey: 'key1' });
			expect(service.getPublicUrl(file)).toBe('https://example.com/files/key1');
		});

		test('falls back to media proxy for avatar mode when local proxy unavailable', () => {
			const config = app.get(DI.config);
			config.proxyRemoteFiles = true;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: true, webpublicAccessKey: null });
			expect(service.getPublicUrl(file, 'avatar')).toBe('https://example.com/proxy/avatar.webp?url=https%3A%2F%2Fexample.com%2Ffiles%2Ffile1-webpublic&avatar=1');
		});

		test('uses avatar proxy for avatar mode', () => {
			const file = createDriveFile();
			expect(service.getPublicUrl(file, 'avatar')).toBe('https://example.com/proxy/avatar.webp?url=https%3A%2F%2Fexample.com%2Ffiles%2Ffile1-webpublic&avatar=1');
		});

		test('returns url for remote non-link without proxy', () => {
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: false });
			expect(service.getPublicUrl(file)).toBe('https://example.com/files/file1-webpublic');
		});

		test('falls back to url when remote link key is invalid', () => {
			const config = app.get(DI.config);
			config.proxyRemoteFiles = true;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: true, webpublicAccessKey: 'key/invalid' });
			expect(service.getPublicUrl(file)).toBe('https://example.com/files/file1-webpublic');
		});

		test('falls back to url when remote link has no key', () => {
			const config = app.get(DI.config);
			config.proxyRemoteFiles = true;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: true, webpublicAccessKey: null });
			expect(service.getPublicUrl(file)).toBe('https://example.com/files/file1-webpublic');
		});

		test('uses avatar proxy fallback when remote link key is invalid', () => {
			const config = app.get(DI.config);
			config.proxyRemoteFiles = true;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: true, webpublicAccessKey: 'key/invalid' });
			expect(service.getPublicUrl(file, 'avatar')).toBe('https://example.com/proxy/avatar.webp?url=https%3A%2F%2Fexample.com%2Ffiles%2Ffile1-webpublic&avatar=1');
		});

		test('uses avatar proxy with uri when remote link key is valid', () => {
			const config = app.get(DI.config);
			config.proxyRemoteFiles = true;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: true, webpublicAccessKey: 'key1' });
			expect(service.getPublicUrl(file, 'avatar')).toBe('https://example.com/proxy/avatar.webp?url=https%3A%2F%2Fremote.example%2Ffile.png&avatar=1');
		});
	});

	describe('calcDriveUsageOf', () => {
		test('returns parsed sum for user id', async () => {
			const result = await service.calcDriveUsageOf('user1');
			expect(result).toBe(1024);
			expect(driveFilesRepository.createQueryBuilder).toHaveBeenCalledWith('file');
		});

		test('returns parsed sum for user object', async () => {
			const result = await service.calcDriveUsageOf({ id: 'user1' });
			expect(result).toBe(1024);
		});
	});

	describe('calcDriveUsageOfHost', () => {
		test('returns parsed sum for host', async () => {
			const result = await service.calcDriveUsageOfHost('remote.example');
			expect(result).toBe(1024);
		});
	});

	describe('calcDriveUsageOfLocal', () => {
		test('returns parsed sum for local files', async () => {
			const result = await service.calcDriveUsageOfLocal();
			expect(result).toBe(1024);
		});
	});

	describe('calcDriveUsageOfRemote', () => {
		test('returns parsed sum for remote files', async () => {
			const result = await service.calcDriveUsageOfRemote();
			expect(result).toBe(1024);
		});
	});

	describe('pack', () => {
		test('packs file by id', async () => {
			const file = createDriveFile();
			driveFilesRepository.findOneByOrFail.mockResolvedValue(file);

			const packed = await service.pack('file1');

			expect(driveFilesRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'file1' });
			expect(packed.id).toBe('file1');
			expect(packed.url).toBe('https://example.com/files/file1-webpublic');
		});

		test('packs file object directly', async () => {
			const file = createDriveFile();

			const packed = await service.pack(file);

			expect(packed.id).toBe('file1');
		});

		test('packs self file with private properties and url', async () => {
			const file = createDriveFile({ properties: { width: 100, height: 200 } });

			const packed = await service.pack(file, { self: true });

			expect(packed.properties).toEqual({ width: 100, height: 200 });
			expect(packed.url).toBe('https://example.com/files/file1');
		});

		test('includes folder when detail requested and folderId exists', async () => {
			const file = createDriveFile({ folderId: 'folder1' });

			const packed = await service.pack(file, { detail: true });

			expect(driveFolderEntityService.pack).toHaveBeenCalledWith('folder1', { detail: true });
			expect(packed.folder).toEqual({ id: 'folder1' });
		});

		test('includes user when withUser requested', async () => {
			const file = createDriveFile();

			const packed = await service.pack(file, { withUser: true });

			expect(userEntityService.pack).toHaveBeenCalledWith('user1');
			expect(packed.user).toEqual({ id: 'user1' });
			expect(packed.userId).toBe('user1');
		});

		test('omits user when withUser not requested', async () => {
			const file = createDriveFile();

			const packed = await service.pack(file);

			expect(userEntityService.pack).not.toHaveBeenCalled();
			expect(packed.user).toBeNull();
			expect(packed.userId).toBeNull();
		});

		test('omits folder when detail not requested', async () => {
			const file = createDriveFile({ folderId: 'folder1' });

			const packed = await service.pack(file, { detail: false });

			expect(driveFolderEntityService.pack).not.toHaveBeenCalled();
			expect(packed.folder).toBeNull();
		});

		test('packNullable accepts file object', async () => {
			const file = createDriveFile();

			const packed = await service.packNullable(file, { self: true });

			expect(packed).not.toBeNull();
			expect(packed!.url).toBe('https://example.com/files/file1');
		});
	});

	describe('packNullable', () => {
		test('returns null when file id not found', async () => {
			driveFilesRepository.findOneBy.mockResolvedValue(null);

			const packed = await service.packNullable('missing');

			expect(packed).toBeNull();
		});

		test('packs file when found by id', async () => {
			const file = createDriveFile();
			driveFilesRepository.findOneBy.mockResolvedValue(file);

			const packed = await service.packNullable('file1');

			expect(packed).not.toBeNull();
			expect(packed!.id).toBe('file1');
		});
	});

	describe('packMany', () => {
		test('packs multiple files', async () => {
			const files = [createDriveFile({ id: 'file1' }), createDriveFile({ id: 'file2', name: 'other.png' })];

			const packed = await service.packMany(files);

			expect(packed).toHaveLength(2);
			expect(packed[0].id).toBe('file1');
			expect(packed[1].id).toBe('file2');
		});
	});

	describe('packManyByIdsMap', () => {
		test('returns empty map for empty ids', async () => {
			const result = await service.packManyByIdsMap([]);
			expect(result.size).toBe(0);
		});

		test('returns map with found files and null for missing', async () => {
			driveFilesRepository.findBy.mockResolvedValue([createDriveFile({ id: 'file1' })]);

			const result = await service.packManyByIdsMap(['file1', 'file2']);

			expect(result.get('file1')).not.toBeNull();
			expect(result.get('file2')).toBeNull();
		});
	});

	describe('packManyByIds', () => {
		test('returns empty array for empty ids', async () => {
			const result = await service.packManyByIds([]);
			expect(result).toEqual([]);
		});

		test('returns packed files in order', async () => {
			driveFilesRepository.findBy.mockResolvedValue([createDriveFile({ id: 'file2' }), createDriveFile({ id: 'file1' })]);

			const result = await service.packManyByIds(['file1', 'file2']);

			expect(result.map(f => f.id)).toEqual(['file1', 'file2']);
		});
	});

	describe('getThumbnailUrl', () => {
		test('returns video thumbnail using uri when no webpublic or url', () => {
			const file = createDriveFile({ type: 'video/mp4', thumbnailUrl: null, webpublicUrl: null, url: null, uri: 'https://remote.example/video.mp4' });
			expect(service.getThumbnailUrl(file)).toBe('https://example.com/video-thumb');
			expect(videoProcessingService.getExternalVideoThumbnailUrl).toHaveBeenCalledWith('https://remote.example/video.mp4');
		});
	});

	describe('getPublicUrl', () => {
		test('returns webpublic for remote non-link when proxy disabled', () => {
			const config = app.get(DI.config);
			config.proxyRemoteFiles = false;
			const file = createDriveFile({ uri: 'https://remote.example/file.png', userHost: 'remote.example', isLink: false });
			expect(service.getPublicUrl(file)).toBe('https://example.com/files/file1-webpublic');
		});
	});

	describe('validateFileName', () => {
		test('rejects whitespace-only name', () => {
			expect(service.validateFileName('   ')).toBe(false);
		});
	});

	describe('getPublicProperties', () => {
		test('swaps dimensions when orientation is exactly 5', () => {
			const file = createDriveFile({ properties: { width: 100, height: 200, orientation: 5 } });
			expect(service.getPublicProperties(file)).toEqual({ width: 200, height: 100 });
		});
	});
});
