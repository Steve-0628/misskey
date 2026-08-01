process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { DeleteObjectCommandOutput, DeleteObjectCommand, NoSuchKey, InvalidObjectState, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import * as fs from 'node:fs';
import { GlobalModule } from '@/GlobalModule.js';
import { DriveService } from '@/core/DriveService.js';
import { CoreModule } from '@/core/CoreModule.js';
import type { TestingModule } from '@nestjs/testing';
import { DI } from '@/di-symbols.js';
import { MetaService } from '@/core/MetaService.js';
import { FileInfoService } from '@/core/FileInfoService.js';
import { InternalStorageService } from '@/core/InternalStorageService.js';
import { S3Service } from '@/core/S3Service.js';
import { ImageProcessingService } from '@/core/ImageProcessingService.js';
import { VideoProcessingService } from '@/core/VideoProcessingService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { QueueService } from '@/core/QueueService.js';
import { RoleService } from '@/core/RoleService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import DriveChart from '@/core/chart/charts/drive.js';
import PerUserDriveChart from '@/core/chart/charts/per-user-drive.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import { createTemp } from '@/misc/create-temp.js';

describe('DriveService', () => {
	let app: TestingModule;
	let driveService: DriveService;
	const s3Mock = mockClient(S3Client);

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
			providers: [DriveService],
		}).compile();
		app.enableShutdownHooks();
		driveService = app.get<DriveService>(DriveService);
	});

	beforeEach(async () => {
		s3Mock.reset();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('Object storage', () => {
		test('delete a file', async () => {
			s3Mock.on(DeleteObjectCommand)
				.resolves({} as DeleteObjectCommandOutput);

			await driveService.deleteObjectStorageFile('peace of the world');
		});

		test('delete a file then unexpected error', async () => {
			s3Mock.on(DeleteObjectCommand)
				.rejects(new InvalidObjectState({ $metadata: {}, message: '' }));

			await expect(driveService.deleteObjectStorageFile('unexpected')).rejects.toThrowError(Error);
		});

		test('delete a file with no valid key', async () => {
			// Some S3 implementations returns 404 Not Found on deleting with a non-existent key
			s3Mock.on(DeleteObjectCommand)
				.rejects(new NoSuchKey({ $metadata: {}, message: 'allowed error.' }));

			await driveService.deleteObjectStorageFile('lol no way');
		});
	});
});

describe('DriveService addFile branches', () => {
	let driveService: DriveService;
	let tempPath: string;
	let tempCleanup: () => void;
	let persistedFile: DriveFile | null;

	const mockMetaService = { fetch: jest.fn() };
	const mockFileInfoService = { getFileInfo: jest.fn() };
	const mockDriveFilesRepository = { findOneBy: jest.fn(), insert: jest.fn(), findOneByOrFail: jest.fn(), createQueryBuilder: jest.fn() };
	const mockDriveFoldersRepository = { findOneBy: jest.fn() };
	const mockUserProfilesRepository = { findOneBy: jest.fn() };
	const mockInternalStorageService = { saveFromPath: jest.fn(), saveFromBuffer: jest.fn(), del: jest.fn() };
	const mockS3Service = { upload: jest.fn() };
	const mockImageProcessingService = { convertSharpToWebp: jest.fn(), convertSharpToPng: jest.fn() };
	const mockVideoProcessingService = { generateVideoThumbnail: jest.fn() };
	const mockRoleService = { getUserPolicies: jest.fn() };
	const mockUserEntityService = { isLocalUser: jest.fn() };
	const mockDriveFileEntityService = { validateFileName: jest.fn(), calcDriveUsageOf: jest.fn(), pack: jest.fn() };
	const mockIdService = { genId: jest.fn() };
	const mockGlobalEventService = { publishMainStream: jest.fn(), publishDriveStream: jest.fn() };
	const mockQueueService = { createDeleteObjectStorageFileJob: jest.fn() };
	const mockDriveChart = { update: jest.fn() };
	const mockPerUserDriveChart = { update: jest.fn() };
	const mockInstanceChart = { updateDrive: jest.fn() };
	const mockUsersRepository = { findOneByOrFail: jest.fn() };
	const mockDownloadService = {};

	beforeAll(async () => {
		[tempPath, tempCleanup] = await createTemp();
		// write a minimal 1x1 PNG so sharp/generateAlts can run
		fs.writeFileSync(tempPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

		driveService = new DriveService(
			{
				url: 'https://example.com',
				videoThumbnailGenerator: 'https://thumbnail.example.com',
			} as unknown as Config,
			mockUsersRepository as unknown as UsersRepository,
			mockUserProfilesRepository as unknown as UserProfilesRepository,
			mockDriveFilesRepository as unknown as DriveFilesRepository,
			mockDriveFoldersRepository as unknown as DriveFoldersRepository,
			mockFileInfoService as unknown as FileInfoService,
			mockUserEntityService as unknown as UserEntityService,
			mockDriveFileEntityService as unknown as DriveFileEntityService,
			mockIdService as unknown as IdService,
			mockMetaService as unknown as MetaService,
			mockDownloadService as unknown as DownloadService,
			mockInternalStorageService as unknown as InternalStorageService,
			mockS3Service as unknown as S3Service,
			mockImageProcessingService as unknown as ImageProcessingService,
			mockVideoProcessingService as unknown as VideoProcessingService,
			mockGlobalEventService as unknown as GlobalEventService,
			mockQueueService as unknown as QueueService,
			mockRoleService as unknown as RoleService,
			mockDriveChart as unknown as DriveChart,
			mockPerUserDriveChart as unknown as PerUserDriveChart,
			mockInstanceChart as unknown as InstanceChart,
		);
	});

	afterAll(async () => {
		tempCleanup();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockMetaService.fetch.mockResolvedValue({
			useObjectStorage: false,
			enableChartsForFederatedInstances: false,
		});
		mockFileInfoService.getFileInfo.mockResolvedValue({
			md5: 'hash1',
			size: 100,
			width: 1,
			height: 1,
			orientation: undefined,
			blurhash: null,
			type: { ext: 'png', mime: 'image/png' },
		});
		persistedFile = null;
		mockDriveFilesRepository.findOneBy.mockResolvedValue(null);
		mockDriveFilesRepository.insert.mockImplementation(async (file: DriveFile) => {
			persistedFile = file;
			return { identifiers: [{ id: file.id }] };
		});
		mockDriveFilesRepository.findOneByOrFail.mockImplementation(async () => {
			if (persistedFile == null) throw new Error('file-not-found');
			return persistedFile;
		});
		mockDriveFilesRepository.createQueryBuilder.mockReturnValue({
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			addSelect: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			getRawMany: jest.fn().mockResolvedValue([]),
		});
		mockUserProfilesRepository.findOneBy.mockResolvedValue({ alwaysMarkNsfw: false });
		mockRoleService.getUserPolicies.mockResolvedValue({ alwaysMarkNsfw: false, driveCapacityMb: 100 });
		mockUserEntityService.isLocalUser.mockReturnValue(true);
		mockDriveFileEntityService.validateFileName.mockReturnValue(true);
		mockDriveFileEntityService.calcDriveUsageOf.mockResolvedValue(0);
		mockDriveFileEntityService.pack.mockResolvedValue({ id: 'file1' });
		mockIdService.genId.mockReturnValue('file1');
		mockInternalStorageService.saveFromPath.mockReturnValue('https://example.com/files/file1');
		mockImageProcessingService.convertSharpToWebp.mockResolvedValue({ data: Buffer.from('webp'), ext: 'webp', type: 'image/webp' });
		mockImageProcessingService.convertSharpToPng.mockResolvedValue({ data: Buffer.from('png'), ext: 'png', type: 'image/png' });
	});

	function baseArgs() {
		return {
			user: { id: 'user1', host: null },
			path: tempPath,
			name: 'test.png',
		};
	}

	test('addFile returns existing file when same hash found and force is false', async () => {
		const existing = { id: 'existing1' };
		mockDriveFilesRepository.findOneBy.mockResolvedValue(existing);
		const result = await driveService.addFile(baseArgs());
		expect(result).toBe(existing);
		expect(mockDriveFilesRepository.insert).not.toHaveBeenCalled();
	});

	test('addFile with force true skips duplicate check', async () => {
		mockDriveFilesRepository.findOneBy.mockResolvedValue({ id: 'existing1' });
		const result = await driveService.addFile({ ...baseArgs(), force: true });
		expect(result.id).toBe('file1');
		expect(mockDriveFilesRepository.insert).toHaveBeenCalled();
	});

	test('addFile with isLink true stores link without saving body', async () => {
		const result = await driveService.addFile({
			...baseArgs(),
			isLink: true,
			url: 'https://remote.example/image.png',
			uri: 'https://remote.example/image.png',
		});
		expect(result.isLink).toBe(true);
		expect(result.url).toBe('https://remote.example/image.png');
		expect(mockInternalStorageService.saveFromPath).not.toHaveBeenCalled();
		expect(mockS3Service.upload).not.toHaveBeenCalled();
	});

	test('addFile with folderId fetches folder', async () => {
		mockDriveFoldersRepository.findOneBy.mockResolvedValue({ id: 'folder1' });
		const result = await driveService.addFile({ ...baseArgs(), folderId: 'folder1' });
		expect(mockDriveFoldersRepository.findOneBy).toHaveBeenCalledWith({ id: 'folder1', userId: 'user1' });
		expect(result.folderId).toBe('folder1');
	});

	test('addFile throws when folder not found', async () => {
		mockDriveFoldersRepository.findOneBy.mockResolvedValue(null);
		await expect(driveService.addFile({ ...baseArgs(), folderId: 'missing' })).rejects.toThrow('folder-not-found');
	});

	test('addFile marks sensitive when profile alwaysMarkNsfw is true', async () => {
		mockUserProfilesRepository.findOneBy.mockResolvedValue({ alwaysMarkNsfw: true });
		const result = await driveService.addFile(baseArgs());
		expect(result.isSensitive).toBe(true);
	});

	test('addFile marks sensitive when user role alwaysMarkNsfw is true', async () => {
		mockRoleService.getUserPolicies.mockResolvedValue({ alwaysMarkNsfw: true, driveCapacityMb: 100 });
		const result = await driveService.addFile(baseArgs());
		expect(result.isSensitive).toBe(true);
	});

	test('addFile throws No free space for local user over capacity', async () => {
		mockDriveFileEntityService.calcDriveUsageOf.mockResolvedValue(1024 * 1024 * 100);
		await expect(driveService.addFile(baseArgs())).rejects.toThrow('No free space.');
	});

	test('addFile expires old remote files when over capacity', async () => {
		mockUserEntityService.isLocalUser.mockReturnValue(false);
		mockDriveFileEntityService.calcDriveUsageOf.mockResolvedValue(1024 * 1024 * 100);
		mockUsersRepository.findOneByOrFail.mockResolvedValue({ id: 'user1', host: 'remote.example' });
		const result = await driveService.addFile({ ...baseArgs(), user: { id: 'user1', host: 'remote.example' } });
		expect(result.id).toBe('file1');
	});

	test('addFile uses internal storage when object storage disabled', async () => {
		mockMetaService.fetch.mockResolvedValue({ useObjectStorage: false, enableChartsForFederatedInstances: false });
		const result = await driveService.addFile(baseArgs());
		expect(mockInternalStorageService.saveFromPath).toHaveBeenCalled();
		expect(result.storedInternal).toBe(true);
	});

	test('addFile uses object storage when enabled', async () => {
		mockMetaService.fetch.mockResolvedValue({
			useObjectStorage: true,
			objectStorageUseSSL: true,
			objectStorageEndpoint: 's3.example',
			objectStoragePort: null,
			objectStorageBucket: 'bucket',
			objectStoragePrefix: 'misskey',
			objectStorageBaseUrl: 'https://s3.example/bucket',
			objectStorageSetPublicRead: true,
			enableChartsForFederatedInstances: false,
		});
		mockS3Service.upload.mockResolvedValue({ Bucket: 'bucket', Key: 'key', Location: 'loc' });
		const result = await driveService.addFile(baseArgs());
		expect(mockS3Service.upload).toHaveBeenCalled();
		expect(result.storedInternal).toBe(false);
	});

	test('generateAlts skips video thumbnail when videoThumbnailGenerator is configured', async () => {
		const svc = driveService as any;
		const result = await svc.generateAlts(tempPath, 'video/mp4', true);
		expect(result.webpublic).toBeNull();
		expect(result.thumbnail).toBeNull();
	});

	test('generateAlts returns null for non-image non-video type', async () => {
		const svc = driveService as any;
		const result = await svc.generateAlts(tempPath, 'application/pdf', true);
		expect(result.webpublic).toBeNull();
		expect(result.thumbnail).toBeNull();
	});

	test('generateAlts creates webpublic and thumbnail for image', async () => {
		const svc = driveService as any;
		mockImageProcessingService.convertSharpToWebp.mockResolvedValue({ data: Buffer.from('thumb'), ext: 'webp', type: 'image/webp' });
		const result = await svc.generateAlts(tempPath, 'image/png', true);
		expect(mockImageProcessingService.convertSharpToWebp).toHaveBeenCalled();
		expect(result.thumbnail).toBeDefined();
	});
});
