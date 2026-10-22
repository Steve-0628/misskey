process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { Test } from '@nestjs/testing';
import { describe, test, beforeAll, afterAll } from '@jest/globals';
import { GlobalModule } from '@/GlobalModule.js';
import { EndpointsModule } from '@/server/api/EndpointsModule.js';
import { SignupService } from '@/core/SignupService.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import type { DriveFilesRepository } from '@/models/index.js';
import type { User } from '@/models/entities/User.js';

type Exec = {
	exec: (params: any, user: any, token: any) => Promise<any>;
};

describe('endpoints: drive/folders/*, drive/files/*', () => {
	let app: any;
	let foldersCreate: Exec;
	let foldersUpdate: Exec;
	let filesDelete: Exec;
	let filesUpdate: Exec;
	let driveFilesRepository: DriveFilesRepository;
	let idService: IdService;

	let alice: User;
	let bob: User;

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, EndpointsModule],
		}).compile();
		await app.init();
		foldersCreate = app.get('ep:drive/folders/create');
		foldersUpdate = app.get('ep:drive/folders/update');
		filesDelete = app.get('ep:drive/files/delete');
		filesUpdate = app.get('ep:drive/files/update');
		driveFilesRepository = app.get(DI.driveFilesRepository);
		idService = app.get(IdService);

		const signupService = app.get(SignupService);
		alice = (await signupService.signup({ username: 'alice', password: 'alice1234' })).account;
		bob = (await signupService.signup({ username: 'bob', password: 'bob12345' })).account;
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await app.close();
	});

	const createFolder = async (name: string, user: User = alice) => {
		return await foldersCreate.exec({ name }, user, null);
	};

	const createFile = async (user: User = alice, folderId: string | null = null) => {
		return await driveFilesRepository.save({
			id: idService.genId(),
			createdAt: new Date(),
			userId: user.id,
			userHost: null,
			folderId: folderId,
			comment: null,
			properties: {},
			name: 'test.png',
			type: 'image/png',
			md5: idService.genId(),
			size: 1,
			isLink: false,
			storedInternal: true,
			url: 'http://misskey.local/test.png',
			accessKey: idService.genId(),
		});
	};

	describe('drive/folders/create', () => {
		test('creates a folder', async () => {
			const folder = await createFolder('test');
			assert.strictEqual(folder.name, 'test');
			assert.strictEqual(folder.parentId, null);
		});

		test('creates a folder inside a folder', async () => {
			const parent = await createFolder('parent');
			const folder = await foldersCreate.exec({ name: 'child', parentId: parent.id }, alice, null);
			assert.strictEqual(folder.parentId, parent.id);
		});

		test('rejects a non-existent parent folder', async () => {
			await assert.rejects(
				foldersCreate.exec({ name: 'orphan', parentId: '000000000000' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_FOLDER',
			);
		});

		test('rejects another user\'s folder as parent', async () => {
			const bobsFolder = await createFolder('bobs', bob);
			await assert.rejects(
				foldersCreate.exec({ name: 'nope', parentId: bobsFolder.id }, alice, null),
				(err: any) => err.code === 'NO_SUCH_FOLDER',
			);
		});
	});

	describe('drive/folders/update', () => {
		test('moves a folder into another folder and back to the root', async () => {
			const folder = await createFolder('movable');
			const parent = await createFolder('new-parent');

			const moved = await foldersUpdate.exec({ folderId: folder.id, parentId: parent.id }, alice, null);
			assert.strictEqual(moved.parentId, parent.id);

			const root = await foldersUpdate.exec({ folderId: folder.id, parentId: null }, alice, null);
			assert.strictEqual(root.parentId, null);
		});

		test('renames a folder', async () => {
			const folder = await createFolder('old-name');
			const renamed = await foldersUpdate.exec({ folderId: folder.id, name: 'new-name' }, alice, null);
			assert.strictEqual(renamed.name, 'new-name');
		});

		test('rejects a non-existent folder', async () => {
			await assert.rejects(
				foldersUpdate.exec({ folderId: '000000000000', name: 'x' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_FOLDER',
			);
		});

		test('rejects a non-existent parent folder', async () => {
			const folder = await createFolder('f');
			await assert.rejects(
				foldersUpdate.exec({ folderId: folder.id, parentId: '000000000000' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_PARENT_FOLDER',
			);
		});

		test('rejects another user\'s folder as parent', async () => {
			const folder = await createFolder('f');
			const bobsFolder = await createFolder('bobs', bob);
			await assert.rejects(
				foldersUpdate.exec({ folderId: folder.id, parentId: bobsFolder.id }, alice, null),
				(err: any) => err.code === 'NO_SUCH_PARENT_FOLDER',
			);
		});

		test('rejects making a folder its own parent', async () => {
			const folder = await createFolder('self-parent');
			await assert.rejects(
				foldersUpdate.exec({ folderId: folder.id, parentId: folder.id }, alice, null),
				(err: any) => err.code === 'RECURSIVE_NESTING',
			);
		});

		test('rejects a circular two-folder structure', async () => {
			const folder = await createFolder('cycle-a');
			const parent = await createFolder('cycle-b');

			// parent -> folder
			await foldersUpdate.exec({ folderId: parent.id, parentId: folder.id }, alice, null);

			// folder -> parent would close the cycle
			await assert.rejects(
				foldersUpdate.exec({ folderId: folder.id, parentId: parent.id }, alice, null),
				(err: any) => err.code === 'RECURSIVE_NESTING',
			);
		});

		test('rejects a circular structure across three folders', async () => {
			const folderA = await createFolder('deep-a');
			const folderB = await createFolder('deep-b');
			const folderC = await createFolder('deep-c');

			await foldersUpdate.exec({ folderId: folderB.id, parentId: folderA.id }, alice, null);
			await foldersUpdate.exec({ folderId: folderC.id, parentId: folderB.id }, alice, null);

			await assert.rejects(
				foldersUpdate.exec({ folderId: folderA.id, parentId: folderC.id }, alice, null),
				(err: any) => err.code === 'RECURSIVE_NESTING',
			);
		});

		test('cannot move another user\'s folder', async () => {
			const bobsFolder = await createFolder('bobs', bob);
			await assert.rejects(
				foldersUpdate.exec({ folderId: bobsFolder.id, name: 'stolen' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_FOLDER',
			);
		});
	});

	describe('drive/files/delete', () => {
		test('deletes a file and it is gone before the call resolves', async () => {
			const file = await createFile();
			await filesDelete.exec({ fileId: file.id }, alice, null);

			// Regression: the delete must be committed before the call resolves
			const remaining = await driveFilesRepository.findOneBy({ id: file.id });
			assert.strictEqual(remaining, null);
		});

		test('rejects a non-existent file', async () => {
			await assert.rejects(
				filesDelete.exec({ fileId: '000000000000' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_FILE',
			);
		});

		test('rejects deleting another user\'s file', async () => {
			const file = await createFile(alice);
			await assert.rejects(
				filesDelete.exec({ fileId: file.id }, bob, null),
				(err: any) => err.code === 'ACCESS_DENIED',
			);
			// Still there
			const remaining = await driveFilesRepository.findOneBy({ id: file.id });
			assert.strictEqual(remaining != null, true);
		});
	});

	describe('drive/files/update', () => {
		test('renames a file', async () => {
			const file = await createFile();
			const updated = await filesUpdate.exec({ fileId: file.id, name: 'renamed.png' }, alice, null);
			assert.strictEqual(updated.name, 'renamed.png');
		});

		test('treats an empty name as no change', async () => {
			const file = await createFile();
			const updated = await filesUpdate.exec({ fileId: file.id, name: '' }, alice, null);
			assert.strictEqual(updated.name, 'test.png');
		});

		test('rejects a name containing a path separator', async () => {
			const file = await createFile();
			await assert.rejects(
				filesUpdate.exec({ fileId: file.id, name: 'a/b.png' }, alice, null),
				(err: any) => err.code === 'INVALID_FILE_NAME',
			);
		});

		test('rejects a name that is too long', async () => {
			const file = await createFile();
			await assert.rejects(
				filesUpdate.exec({ fileId: file.id, name: 'x'.repeat(201) }, alice, null),
				(err: any) => err.code === 'INVALID_FILE_NAME',
			);
		});

		test('moves a file into a folder and back', async () => {
			const file = await createFile();
			const folder = await createFolder('file-folder');

			const moved = await filesUpdate.exec({ fileId: file.id, folderId: folder.id }, alice, null);
			assert.strictEqual(moved.folderId, folder.id);

			const root = await filesUpdate.exec({ fileId: file.id, folderId: null }, alice, null);
			assert.strictEqual(root.folderId, null);
		});

		test('rejects a non-existent folder', async () => {
			const file = await createFile();
			await assert.rejects(
				filesUpdate.exec({ fileId: file.id, folderId: '000000000000' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_FOLDER',
			);
		});

		test('rejects another user\'s folder', async () => {
			const file = await createFile();
			const bobsFolder = await createFolder('bobs', bob);
			await assert.rejects(
				filesUpdate.exec({ fileId: file.id, folderId: bobsFolder.id }, alice, null),
				(err: any) => err.code === 'NO_SUCH_FOLDER',
			);
		});

		test('rejects updating another user\'s file', async () => {
			const file = await createFile(alice);
			await assert.rejects(
				filesUpdate.exec({ fileId: file.id, name: 'stolen.png' }, bob, null),
				(err: any) => err.code === 'ACCESS_DENIED',
			);
		});

		test('rejects a non-existent file', async () => {
			await assert.rejects(
				filesUpdate.exec({ fileId: '000000000000', name: 'x.png' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_FILE',
			);
		});
	});
});
