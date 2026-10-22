process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { Test } from '@nestjs/testing';
import { describe, test, beforeAll, afterAll } from '@jest/globals';
import { GlobalModule } from '@/GlobalModule.js';
import { EndpointsModule } from '@/server/api/EndpointsModule.js';
import { SignupService } from '@/core/SignupService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { DI } from '@/di-symbols.js';
import type { NotesRepository, NoteReactionsRepository } from '@/models/index.js';
import type { User } from '@/models/entities/User.js';

type Exec = {
	exec: (params: any, user: any, token: any) => Promise<any>;
};

describe('endpoints: notes/*', () => {
	let app: any;
	let notesCreate: Exec;
	let notesDelete: Exec;
	let notesShow: Exec;
	let reactionsCreate: Exec;
	let reactionsDelete: Exec;
	let noteCreateService: NoteCreateService;
	let notesRepository: NotesRepository;
	let noteReactionsRepository: NoteReactionsRepository;

	let alice: User;
	let bob: User;

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, EndpointsModule],
		}).compile();
		await app.init();
		notesCreate = app.get('ep:notes/create');
		notesDelete = app.get('ep:notes/delete');
		notesShow = app.get('ep:notes/show');
		reactionsCreate = app.get('ep:notes/reactions/create');
		reactionsDelete = app.get('ep:notes/reactions/delete');
		noteCreateService = app.get(NoteCreateService);
		notesRepository = app.get(DI.notesRepository);
		noteReactionsRepository = app.get(DI.noteReactionsRepository);

		const signupService = app.get(SignupService);
		alice = (await signupService.signup({ username: 'alice', password: 'alice1234' })).account;
		bob = (await signupService.signup({ username: 'bob', password: 'bob12345' })).account;
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await app.close();
	});

	// Counter updates (repliesCount, renoteCount, …) run in NoteCreateService's
	// postNoteCreated hook, which is deferred via setImmediate by design.
	// Poll until the condition holds (bounded) instead of asserting synchronously.
	const eventually = async (cond: () => Promise<boolean>, message: string) => {
		const deadline = Date.now() + 5000;
		while (Date.now() < deadline) {
			if (await cond()) return;
			await new Promise(resolve => setTimeout(resolve, 50));
		}
		assert.fail(message);
	};

	describe('notes/create', () => {
		test('creates a note', async () => {
			const res = await notesCreate.exec({ text: 'hello' }, alice, null);
			assert.strictEqual(res.createdNote.text, 'hello');
			assert.strictEqual(res.createdNote.userId, alice.id);
		});

		test('creates a note with a content warning', async () => {
			const res = await notesCreate.exec({ text: 'secret', cw: 'spoiler' }, alice, null);
			assert.strictEqual(res.createdNote.cw, 'spoiler');
		});

		test('creates a reply and bumps the parent repliesCount', async () => {
			const parent = await noteCreateService.create(alice, { text: 'parent' });
			const res = await notesCreate.exec({ text: 'a reply', replyId: parent.id }, alice, null);
			assert.strictEqual(res.createdNote.replyId, parent.id);
			await eventually(async () =>
				(await notesRepository.findOneByOrFail({ id: parent.id })).repliesCount === 1,
			'repliesCount was not incremented');
		});

		test('creates a renote and bumps the target renoteCount', async () => {
			const target = await noteCreateService.create(alice, { text: 'renote me' });
			const res = await notesCreate.exec({ renoteId: target.id }, alice, null);
			assert.strictEqual(res.createdNote.renoteId, target.id);
			await eventually(async () =>
				(await notesRepository.findOneByOrFail({ id: target.id })).renoteCount === 1,
			'renoteCount was not incremented');
		});

		test('creates a poll', async () => {
			const res = await notesCreate.exec({
				text: 'poll',
				poll: { choices: ['a', 'b'], expiresAt: Date.now() + 1000 * 60 * 60 },
			}, alice, null);
			assert.strictEqual(res.createdNote.poll != null, true);
		});

		test('rejects an already expired poll', async () => {
			await assert.rejects(
				notesCreate.exec({
					text: 'expired poll',
					poll: { choices: ['a', 'b'], expiresAt: Date.now() - 1000 },
				}, alice, null),
				(err: any) => err.code === 'CANNOT_CREATE_ALREADY_EXPIRED_POLL',
			);
		});

		test('rejects replying to a non-existent note', async () => {
			await assert.rejects(
				notesCreate.exec({ text: 'x', replyId: '000000000000' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_REPLY_TARGET',
			);
		});

		test('rejects renoting a non-existent note', async () => {
			await assert.rejects(
				notesCreate.exec({ renoteId: '000000000000' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_RENOTE_TARGET',
			);
		});

		test('rejects renoting a pure renote', async () => {
			const target = await noteCreateService.create(alice, { text: 'original' });
			const pureRenote = await noteCreateService.create(alice, { renote: target });
			await assert.rejects(
				notesCreate.exec({ renoteId: pureRenote.id }, alice, null),
				(err: any) => err.code === 'CANNOT_RENOTE_TO_A_PURE_RENOTE',
			);
		});

		test('rejects replying to a pure renote', async () => {
			const target = await noteCreateService.create(alice, { text: 'original' });
			const pureRenote = await noteCreateService.create(alice, { renote: target });
			await assert.rejects(
				notesCreate.exec({ text: 'x', replyId: pureRenote.id }, alice, null),
				(err: any) => err.code === 'CANNOT_REPLY_TO_A_PURE_RENOTE',
			);
		});

		test('rejects attaching a non-existent file', async () => {
			await assert.rejects(
				notesCreate.exec({ text: 'x', fileIds: ['000000000000'] }, alice, null),
				(err: any) => err.code === 'NO_SUCH_FILE',
			);
		});
	});

	describe('notes/delete', () => {
		test('deletes a note and it is gone before the call resolves', async () => {
			const note = await noteCreateService.create(alice, { text: 'delete me' });
			await notesDelete.exec({ noteId: note.id }, alice, null);

			const remaining = await notesRepository.findOneBy({ id: note.id });
			assert.strictEqual(remaining, null);
		});

		test('rejects deleting a non-existent note', async () => {
			await assert.rejects(
				notesDelete.exec({ noteId: '000000000000' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_NOTE',
			);
		});

		test('rejects deleting another user\'s note', async () => {
			const note = await noteCreateService.create(alice, { text: 'mine' });
			await assert.rejects(
				notesDelete.exec({ noteId: note.id }, bob, null),
				(err: any) => err.code === 'ACCESS_DENIED',
			);
			assert.strictEqual(await notesRepository.exist({ where: { id: note.id } }), true);
		});
	});

	describe('notes/reactions/create, notes/reactions/delete', () => {
		test('creates and removes a reaction', async () => {
			const note = await noteCreateService.create(alice, { text: 'react to me' });

			await reactionsCreate.exec({ noteId: note.id, reaction: '👍' }, bob, null);
			assert.strictEqual(await noteReactionsRepository.exist({ where: { noteId: note.id, userId: bob.id } }), true);
			const reloaded = await notesRepository.findOneByOrFail({ id: note.id });
			assert.strictEqual(reloaded.reactions['👍'], 1);

			await reactionsDelete.exec({ noteId: note.id }, bob, null);
			assert.strictEqual(await noteReactionsRepository.exist({ where: { noteId: note.id, userId: bob.id } }), false);
		});

		test('rejects reacting to the same note twice with the same reaction', async () => {
			const note = await noteCreateService.create(alice, { text: 'only one reaction' });
			await reactionsCreate.exec({ noteId: note.id, reaction: '👍' }, bob, null);
			await assert.rejects(
				reactionsCreate.exec({ noteId: note.id, reaction: '👍' }, bob, null),
				(err: any) => err.code === 'ALREADY_REACTED',
			);
		});

		test('rejects reacting to a non-existent note', async () => {
			await assert.rejects(
				reactionsCreate.exec({ noteId: '000000000000', reaction: '👍' }, bob, null),
				(err: any) => err.code === 'NO_SUCH_NOTE',
			);
		});

		test('rejects removing a reaction that does not exist', async () => {
			const note = await noteCreateService.create(alice, { text: 'unreacted' });
			await assert.rejects(
				reactionsDelete.exec({ noteId: note.id }, bob, null),
				(err: any) => err.code === 'NOT_REACTED',
			);
		});

		test('rejects reacting when the note author blocks you', async () => {
			const note = await noteCreateService.create(bob, { text: 'blocked note' });
			const blockingCreate = app.get('ep:blocking/create');
			const blockingDelete = app.get('ep:blocking/delete');
			await blockingCreate.exec({ userId: alice.id }, bob, null);
			try {
				await assert.rejects(
					reactionsCreate.exec({ noteId: note.id, reaction: '👍' }, alice, null),
					(err: any) => err.code === 'YOU_HAVE_BEEN_BLOCKED',
				);
			} finally {
				await blockingDelete.exec({ userId: alice.id }, bob, null);
			}
		});
	});

	describe('notes/show', () => {
		test('shows a note', async () => {
			const note = await noteCreateService.create(alice, { text: 'visible' });
			const res = await notesShow.exec({ noteId: note.id }, bob, null);
			assert.strictEqual(res.id, note.id);
			assert.strictEqual(res.text, 'visible');
		});

		test('rejects showing a non-existent note', async () => {
			await assert.rejects(
				notesShow.exec({ noteId: '000000000000' }, bob, null),
				(err: any) => err.code === 'NO_SUCH_NOTE',
			);
		});
	});
});
