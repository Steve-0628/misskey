process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { Test } from '@nestjs/testing';
import { describe, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';
import { SignupService } from '@/core/SignupService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { NotePiningService } from '@/core/NotePiningService.js';
import type { UserNotePiningsRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import type { User } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';

describe('NotePiningService', () => {
	let app: any;
	let notePiningService: NotePiningService;
	let noteCreateService: NoteCreateService;
	let userNotePiningsRepository: UserNotePiningsRepository;
	let signupService: SignupService;

	let alice: User;
	let bob: User;
	let aliceNote: Note;

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		await app.init();
		notePiningService = app.get(NotePiningService);
		noteCreateService = app.get(NoteCreateService);
		signupService = app.get(SignupService);
		userNotePiningsRepository = app.get(DI.userNotePiningsRepository);

		alice = (await signupService.signup({ username: 'alice', password: 'alice1234' })).account;
		bob = (await signupService.signup({ username: 'bob', password: 'bob12345' })).account;
		aliceNote = await noteCreateService.create(alice, { text: 'test' });
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await app.close();
	});

	beforeEach(async () => {
		await userNotePiningsRepository.createQueryBuilder().delete().execute();
	});

	describe('addPinned', () => {
		test('pins a note of the user', async () => {
			await notePiningService.addPinned(alice, aliceNote.id);
			const pinings = await userNotePiningsRepository.findBy({ userId: alice.id });
			assert.strictEqual(pinings.length, 1);
			assert.strictEqual(pinings[0].noteId, aliceNote.id);
		});

		test('cannot pin a note of another user', async () => {
			await assert.rejects(
				notePiningService.addPinned(bob, aliceNote.id),
				(err: any) => err.id === '70c4e51f-5bea-449c-a030-53bee3cce202',
			);
		});

		test('cannot pin a non-existent note', async () => {
			await assert.rejects(
				notePiningService.addPinned(alice, '000000000000'),
				(err: any) => err.id === '70c4e51f-5bea-449c-a030-53bee3cce202',
			);
		});

		test('cannot pin the same note twice', async () => {
			await notePiningService.addPinned(alice, aliceNote.id);
			await assert.rejects(
				notePiningService.addPinned(alice, aliceNote.id),
				(err: any) => err.id === '23f0cf4e-59a3-4276-a91d-61a5891c1514',
			);
		});

		test('cannot pin more notes than the pin limit', async () => {
			const limit = 5; // default policy pinLimit
			for (let i = 0; i < limit; i++) {
				const note = await noteCreateService.create(alice, { text: `pin-limit-${i}` });
				await notePiningService.addPinned(alice, note.id);
			}
			const overflow = await noteCreateService.create(alice, { text: 'pin-limit-overflow' });
			await assert.rejects(
				notePiningService.addPinned(alice, overflow.id),
				(err: any) => err.id === '15a018eb-58e5-4da1-93be-330fcc5e4e1a',
			);
		});
	});

	describe('removePinned', () => {
		test('unpins a note', async () => {
			await notePiningService.addPinned(alice, aliceNote.id);
			await notePiningService.removePinned(alice, aliceNote.id);

			// The unpin must be committed before removePinned resolves
			const pinings = await userNotePiningsRepository.findBy({ userId: alice.id });
			assert.strictEqual(pinings.length, 0);
		});

		test('unpinning a note that is not pinned resolves without error (idempotent)', async () => {
			await notePiningService.removePinned(alice, aliceNote.id);
			const pinings = await userNotePiningsRepository.findBy({ userId: alice.id });
			assert.strictEqual(pinings.length, 0);
		});

		test('cannot unpin a non-existent note', async () => {
			await assert.rejects(
				notePiningService.removePinned(alice, '000000000000'),
				(err: any) => err.id === 'b302d4cf-c050-400a-bbb3-be208681f40c',
			);
		});

		test('cannot unpin a note of another user', async () => {
			await notePiningService.addPinned(alice, aliceNote.id);
			await assert.rejects(
				notePiningService.removePinned(bob, aliceNote.id),
				(err: any) => err.id === 'b302d4cf-c050-400a-bbb3-be208681f40c',
			);
			// Alice's pin is untouched
			const pinings = await userNotePiningsRepository.findBy({ userId: alice.id });
			assert.strictEqual(pinings.length, 1);
		});
	});
});
