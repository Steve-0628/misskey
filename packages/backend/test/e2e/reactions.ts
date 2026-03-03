process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { signup, post, api, startServer } from '../utils.js';
import type { INestApplicationContext } from '@nestjs/common';
import type * as misskey from 'misskey-js';

describe('Reactions', () => {
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

	describe('notes/reactions/create', () => {
		test('can react to a note', async () => {
			const note = await post(alice, { text: 'hello' });

			const res = await api('/notes/reactions/create', {
				noteId: note.id,
				reaction: '👍',
			}, bob);

			assert.strictEqual(res.status, 204);
		});

		test('cannot react to the same note twice', async () => {
			const note = await post(alice, { text: 'unique note for double-react' });

			await api('/notes/reactions/create', { noteId: note.id, reaction: '👍' }, bob);
			const res = await api('/notes/reactions/create', { noteId: note.id, reaction: '❤️' }, bob);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'ALREADY_REACTED');
		});

		test('cannot react to a non-existent note', async () => {
			const res = await api('/notes/reactions/create', {
				noteId: '0000000000000000',
				reaction: '👍',
			}, bob);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'NO_SUCH_NOTE');
		});

		test('cannot react without authentication', async () => {
			const note = await post(alice, { text: 'hello' });

			const res = await api('/notes/reactions/create', {
				noteId: note.id,
				reaction: '👍',
			});

			assert.strictEqual(res.status, 401);
		});
	});

	describe('notes/reactions/delete', () => {
		test('can remove a reaction', async () => {
			const note = await post(alice, { text: 'note for reaction removal' });

			await api('/notes/reactions/create', { noteId: note.id, reaction: '👍' }, bob);

			const res = await api('/notes/reactions/delete', { noteId: note.id }, bob);

			assert.strictEqual(res.status, 204);
		});

		test('cannot remove a reaction that was not added', async () => {
			const note = await post(alice, { text: 'note with no reaction from alice' });

			const res = await api('/notes/reactions/delete', { noteId: note.id }, alice);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'NOT_REACTED');
		});

		test('cannot remove a reaction from a non-existent note', async () => {
			const res = await api('/notes/reactions/delete', {
				noteId: '0000000000000000',
			}, alice);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'NO_SUCH_NOTE');
		});
	});

	describe('notes/reactions', () => {
		test('can list reactions on a note', async () => {
			const note = await post(alice, { text: 'note for reaction listing' });

			await api('/notes/reactions/create', { noteId: note.id, reaction: '👍' }, bob);

			const res = await api('/notes/reactions', { noteId: note.id }, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.length >= 1, true);
			assert.strictEqual(res.body.some((r: any) => r.type === '👍'), true);
		});

		test('returns empty array for a note with no reactions', async () => {
			const note = await post(alice, { text: 'note with no reactions' });

			const res = await api('/notes/reactions', { noteId: note.id }, alice);

			assert.strictEqual(res.status, 200);
			assert.deepStrictEqual(res.body, []);
		});

		test('returns 400 for a non-existent note', async () => {
			const res = await api('/notes/reactions', {
				noteId: '0000000000000000',
			}, alice);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'NO_SUCH_NOTE');
		});
	});
});
