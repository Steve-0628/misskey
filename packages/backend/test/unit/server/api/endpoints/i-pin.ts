process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { Test } from '@nestjs/testing';
import { describe, test, beforeAll, afterAll, afterEach } from '@jest/globals';
import { GlobalModule } from '@/GlobalModule.js';
import { EndpointsModule } from '@/server/api/EndpointsModule.js';
import { SignupService } from '@/core/SignupService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { DI } from '@/di-symbols.js';
import type { UserNotePiningsRepository } from '@/models/index.js';
import type { User } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';

type Exec = {
	exec: (params: any, user: any, token: any) => Promise<any>;
};

describe('endpoints: i/pin, i/unpin', () => {
	let app: any;
	let pin: Exec;
	let unpin: Exec;
	let noteCreateService: NoteCreateService;

	let alice: User;
	let bob: User;
	let aliceNote: Note;

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, EndpointsModule],
		}).compile();
		await app.init();
		pin = app.get('ep:i/pin');
		unpin = app.get('ep:i/unpin');
		noteCreateService = app.get(NoteCreateService);

		const signupService = app.get(SignupService);
		alice = (await signupService.signup({ username: 'alice', password: 'alice1234' })).account;
		bob = (await signupService.signup({ username: 'bob', password: 'bob12345' })).account;
		aliceNote = await noteCreateService.create(alice, { text: 'test' });
	}, 1000 * 60 * 2);

	afterEach(async () => {
		const userNotePiningsRepository = app.get(DI.userNotePiningsRepository) as UserNotePiningsRepository;
		await userNotePiningsRepository.createQueryBuilder().delete().execute();
	});

	afterAll(async () => {
		await app.close();
	});

	test('i/pin pins a note and reflects it in the response', async () => {
		const res = await pin.exec({ noteId: aliceNote.id }, alice, null);
		assert.deepStrictEqual(res.pinnedNoteIds, [aliceNote.id]);
		assert.strictEqual(res.pinnedNotes.length, 1);
		assert.strictEqual(res.pinnedNotes[0].id, aliceNote.id);
	});

	test('i/pin rejects a non-existent note', async () => {
		await assert.rejects(
			pin.exec({ noteId: '000000000000' }, alice, null),
			(err: any) => err.code === 'NO_SUCH_NOTE',
		);
	});

	test('i/pin rejects an invalid note id', async () => {
		await assert.rejects(
			pin.exec({ noteId: '!' }, alice, null),
			(err: any) => err.code === 'INVALID_PARAM',
		);
	});

	test('i/unpin removes the note and the response no longer contains it', async () => {
		await pin.exec({ noteId: aliceNote.id }, alice, null);
		const res = await unpin.exec({ noteId: aliceNote.id }, alice, null);

		// Regression: the unpin write must be committed before the response is packed
		assert.deepStrictEqual(res.pinnedNoteIds, []);
		assert.deepStrictEqual(res.pinnedNotes, []);
	});

	test('i/unpin rejects a non-existent note', async () => {
		await assert.rejects(
			unpin.exec({ noteId: '000000000000' }, alice, null),
			(err: any) => err.code === 'NO_SUCH_NOTE',
		);
	});

	test('i/unpin cannot unpin a note of another user', async () => {
		await pin.exec({ noteId: aliceNote.id }, alice, null);
		await assert.rejects(
			unpin.exec({ noteId: aliceNote.id }, bob, null),
			(err: any) => err.code === 'NO_SUCH_NOTE',
		);
		// Alice's pin is untouched
		const userNotePiningsRepository = app.get(DI.userNotePiningsRepository) as UserNotePiningsRepository;
		const pinings = await userNotePiningsRepository.findBy({ userId: alice.id });
		assert.strictEqual(pinings.length, 1);
		assert.strictEqual(pinings[0].noteId, aliceNote.id);
	});
});
