process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import CreateEndpoint from '@/server/api/endpoints/notes/create.js';
import type { UsersRepository, NotesRepository, BlockingsRepository, DriveFilesRepository } from '@/models/index.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { NoteCreateService } from '@/core/NoteCreateService.js';

describe('notes/create endpoint', () => {
	function createEndpoint() {
		const usersRepository = {
			findBy: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<UsersRepository>;

		const notesRepository = {
			findOneBy: jest.fn().mockResolvedValue(null),
		} as unknown as jest.Mocked<NotesRepository>;

		const blockingsRepository = {
			exist: jest.fn().mockResolvedValue(false),
		} as unknown as jest.Mocked<BlockingsRepository>;

		const driveFilesRepository = {} as unknown as jest.Mocked<DriveFilesRepository>;

		const noteEntityService = {
			pack: jest.fn().mockResolvedValue({ id: 'note1' }),
		} as unknown as jest.Mocked<NoteEntityService>;

		const noteCreateService = {
			create: jest.fn().mockResolvedValue({ id: 'note1' }),
		} as unknown as jest.Mocked<NoteCreateService>;

		const endpoint = new CreateEndpoint(
			usersRepository,
			notesRepository,
			blockingsRepository,
			driveFilesRepository,
			noteEntityService,
			noteCreateService,
		);

		return {
			endpoint,
			mocks: {
				usersRepository,
				notesRepository,
				blockingsRepository,
				noteEntityService,
				noteCreateService,
			},
		};
	}

	function createUser() {
		return {
			id: 'user1',
			host: null,
		} as any;
	}

	test('creates simple note', async () => {
		const { endpoint, mocks } = createEndpoint();

		const result = await endpoint.exec({ text: 'hello' }, createUser(), null);

		expect(mocks.noteCreateService.create).toHaveBeenCalled();
		expect(result).toEqual({ createdNote: { id: 'note1' } });
	});

	test('rejects invalid params', async () => {
		const { endpoint } = createEndpoint();

		await expect(endpoint.exec({}, createUser(), null)).rejects.toThrow('Invalid param.');
	});

	test('throws when renote target not found', async () => {
		const { endpoint } = createEndpoint();

		await expect(endpoint.exec({ renoteId: 'missing' }, createUser(), null)).rejects.toThrow('No such renote target.');
	});

	test('throws when renote target is pure renote', async () => {
		const { endpoint, mocks } = createEndpoint();
		mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'renote1', renoteId: 'orig', text: null, fileIds: null, hasPoll: false, userId: 'other' } as any);

		await expect(endpoint.exec({ renoteId: 'renote1' }, createUser(), null)).rejects.toThrow('You can not Renote a pure Renote.');
	});

	test('throws when blocked by renote author', async () => {
		const { endpoint, mocks } = createEndpoint();
		mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'renote1', renoteId: null, text: 'hello', fileIds: [], hasPoll: false, userId: 'other' } as any);
		mocks.blockingsRepository.exist.mockResolvedValue(true);

		await expect(endpoint.exec({ renoteId: 'renote1' }, createUser(), null)).rejects.toThrow('You have been blocked by this user.');
	});

	test('throws when reply target not found', async () => {
		const { endpoint } = createEndpoint();

		await expect(endpoint.exec({ text: 'reply', replyId: 'missing' }, createUser(), null)).rejects.toThrow('No such reply target.');
	});

	test('throws when reply target is pure renote', async () => {
		const { endpoint, mocks } = createEndpoint();
		mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'reply1', renoteId: 'orig', text: null, fileIds: null, hasPoll: false, userId: 'other' } as any);

		await expect(endpoint.exec({ text: 'reply', replyId: 'reply1' }, createUser(), null)).rejects.toThrow('You can not reply to a pure Renote.');
	});

	test('throws when poll already expired', async () => {
		const { endpoint } = createEndpoint();

		await expect(endpoint.exec({
			text: 'poll',
			poll: { choices: ['a', 'b'], expiresAt: Date.now() - 1000 },
		}, createUser(), null)).rejects.toThrow('Poll is already expired.');
	});

	test('sets poll expiresAt from expiredAfter', async () => {
		const { endpoint, mocks } = createEndpoint();

		await endpoint.exec({
			text: 'poll',
			poll: { choices: ['a', 'b'], expiredAfter: 3600000 },
		}, createUser(), null);

		const callArg = mocks.noteCreateService.create.mock.calls[0][1];
		expect(callArg.poll?.expiresAt).toBeInstanceOf(Date);
	});
});
