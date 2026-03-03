process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { signup, api, uploadFile, startServer } from '../utils.js';
import type { INestApplicationContext } from '@nestjs/common';
import type * as misskey from 'misskey-js';

describe('Drive', () => {
	let app: INestApplicationContext;

	let alice: misskey.entities.MeSignup;
	let bob: misskey.entities.MeSignup;

	beforeAll(async () => {
		app = await startServer();
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await app.close();
	});

	describe('drive/files/create', () => {
		test('can upload a file', async () => {
			const res = await uploadFile(alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body != null, true);
			assert.strictEqual(typeof res.body!.id, 'string');
			assert.strictEqual(typeof res.body!.name, 'string');
		});

		test('upload returns the file with correct properties', async () => {
			const res = await uploadFile(alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body != null, true);
			assert.strictEqual(typeof res.body!.id, 'string');
			assert.strictEqual(typeof res.body!.size, 'number');
			assert.strictEqual(typeof res.body!.md5, 'string');
		});

		test('cannot upload without authentication', async () => {
			const res = await uploadFile();

			assert.strictEqual(res.status, 401);
		});
	});

	describe('drive/files', () => {
		test('can list own files', async () => {
			await uploadFile(alice);

			const res = await api('/drive/files', {}, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.length >= 1, true);
		});

		test('cannot list files without authentication', async () => {
			const res = await api('/drive/files', {});

			assert.strictEqual(res.status, 401);
		});

		test('does not include other users files in own list', async () => {
			const aliceFile = await uploadFile(alice);
			const bobFile = await uploadFile(bob);

			const res = await api('/drive/files', {}, alice);

			assert.strictEqual(res.status, 200);
			const ids = res.body.map((f: any) => f.id);
			assert.strictEqual(ids.includes(aliceFile.body!.id), true);
			assert.strictEqual(ids.includes(bobFile.body!.id), false);
		});
	});

	describe('drive/files/delete', () => {
		test('can delete own file', async () => {
			const file = await uploadFile(alice);
			assert.strictEqual(file.status, 200);

			const res = await api('/drive/files/delete', {
				fileId: file.body!.id,
			}, alice);

			assert.strictEqual(res.status, 204);
		});

		test('cannot delete another users file', async () => {
			const file = await uploadFile(alice);
			assert.strictEqual(file.status, 200);

			const res = await api('/drive/files/delete', {
				fileId: file.body!.id,
			}, bob);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'ACCESS_DENIED');
		});

		test('cannot delete a non-existent file', async () => {
			const res = await api('/drive/files/delete', {
				fileId: '0000000000000000',
			}, alice);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'NO_SUCH_FILE');
		});

		test('deleted file no longer appears in file list', async () => {
			const file = await uploadFile(alice);
			assert.strictEqual(file.status, 200);
			const fileId = file.body!.id;

			await api('/drive/files/delete', { fileId }, alice);

			const res = await api('/drive/files', {}, alice);
			const ids = res.body.map((f: any) => f.id);
			assert.strictEqual(ids.includes(fileId), false);
		});
	});
});
