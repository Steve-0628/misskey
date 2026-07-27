process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import type { Config } from '@/config.js';
import type { NotesRepository, UsersRepository, InstancesRepository } from '@/models/index.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import type { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import type { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import type { MetaService } from '@/core/MetaService.js';
import type { SearchService } from '@/core/SearchService.js';
import type NotesChart from '@/core/chart/charts/notes.js';
import type PerUserNotesChart from '@/core/chart/charts/per-user-notes.js';
import type InstanceChart from '@/core/chart/charts/instance.js';
import type { Note } from '@/models/entities/Note.js';
import type { User, LocalUser, RemoteUser } from '@/models/entities/User.js';

function createUser(data: Partial<User> = {}): User {
	return {
		id: 'user1',
		host: null,
		isBot: false,
		...data,
	} as unknown as User;
}

function createNote(data: Partial<Note> = {}): Note {
	return {
		id: 'note1',
		userId: 'user1',
		createdAt: new Date(),
		mentionedRemoteUsers: '[]',
		localOnly: false,
		...data,
	} as unknown as Note;
}

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const notesRepository = {
		decrement: jest.fn().mockResolvedValue(undefined),
		delete: jest.fn().mockResolvedValue(undefined),
		findOneBy: jest.fn().mockResolvedValue(null),
		createQueryBuilder: jest.fn().mockReturnValue({
			where: jest.fn().mockReturnThis(),
			orWhere: jest.fn().mockReturnThis(),
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([]),
		}),
	} as unknown as jest.Mocked<NotesRepository>;

	const usersRepository = {
		find: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<UsersRepository>;

	const instancesRepository = {
		decrement: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<InstancesRepository>;

	const userEntityService = {
		isLocalUser: jest.fn().mockReturnValue(true),
		isRemoteUser: jest.fn().mockReturnValue(false),
	} as unknown as jest.Mocked<UserEntityService>;

	const noteEntityService = {
		countSameRenotes: jest.fn().mockResolvedValue(0),
	} as unknown as jest.Mocked<NoteEntityService>;

	const globalEventService = {
		publishNoteStream: jest.fn(),
	} as unknown as GlobalEventService;

	const federatedInstanceService = {
		fetch: jest.fn().mockResolvedValue({ id: 'instance1', host: 'remote.example' }),
	} as unknown as FederatedInstanceService;

	const apRendererService = {
		addContext: jest.fn().mockImplementation(x => x),
		renderDelete: jest.fn().mockReturnValue({ type: 'Delete' }),
		renderUndo: jest.fn().mockReturnValue({ type: 'Undo' }),
		renderAnnounce: jest.fn().mockReturnValue({ type: 'Announce' }),
		renderTombstone: jest.fn().mockReturnValue({ type: 'Tombstone' }),
	} as unknown as ApRendererService;

	const apDeliverManagerService = {
		deliverToFollowers: jest.fn(),
		deliverToUser: jest.fn(),
	} as unknown as ApDeliverManagerService;

	const metaService = {
		fetch: jest.fn().mockResolvedValue({ enableChartsForRemoteUser: false, enableChartsForFederatedInstances: false }),
	} as unknown as MetaService;

	const searchService = {
		unindexNote: jest.fn(),
	} as unknown as SearchService;

	const notesChart = {
		update: jest.fn(),
	} as unknown as NotesChart;

	const perUserNotesChart = {
		update: jest.fn(),
	} as unknown as PerUserNotesChart;

	const instanceChart = {
		updateNote: jest.fn(),
	} as unknown as InstanceChart;

	const service = new NoteDeleteService(
		config,
		usersRepository,
		notesRepository,
		instancesRepository,
		userEntityService,
		noteEntityService,
		globalEventService,
		federatedInstanceService,
		apRendererService,
		apDeliverManagerService,
		metaService,
		searchService,
		notesChart,
		perUserNotesChart,
		instanceChart,
	);

	return {
		service,
		mocks: {
			notesRepository,
			usersRepository,
			instancesRepository,
			userEntityService,
			noteEntityService,
			globalEventService,
			federatedInstanceService,
			apRendererService,
			apDeliverManagerService,
			metaService,
			searchService,
			notesChart,
			perUserNotesChart,
			instanceChart,
		},
	};
}

describe('NoteDeleteService', () => {
	test('delete simple local note', async () => {
		const { service, mocks } = createService();
		const user = createUser();
		const note = createNote();

		await service.delete(user, note);

		expect(mocks.notesRepository.delete).toHaveBeenCalledWith({ id: 'note1', userId: 'user1' });
		expect(mocks.globalEventService.publishNoteStream).toHaveBeenCalledWith('note1', 'deleted', { deletedAt: expect.any(Date) });
		expect(mocks.apRendererService.renderDelete).toHaveBeenCalled();
		expect(mocks.searchService.unindexNote).toHaveBeenCalledWith(note);
	});

	test('delete with renote decrements renoteCount and score for non-bot', async () => {
		const { service, mocks } = createService();
		const user = createUser();
		const note = createNote({ renoteId: 'renote1' });

		await service.delete(user, note);

		expect(mocks.notesRepository.decrement).toHaveBeenCalledWith({ id: 'renote1' }, 'renoteCount', 1);
		expect(mocks.notesRepository.decrement).toHaveBeenCalledWith({ id: 'renote1' }, 'score', 1);
	});

	test('delete with reply decrements repliesCount', async () => {
		const { service, mocks } = createService();
		const user = createUser();
		const note = createNote({ replyId: 'reply1' });

		await service.delete(user, note);

		expect(mocks.notesRepository.decrement).toHaveBeenCalledWith({ id: 'reply1' }, 'repliesCount', 1);
	});

	test('delete quiet does not publish or deliver', async () => {
		const { service, mocks } = createService();
		const user = createUser();
		const note = createNote();

		await service.delete(user, note, true);

		expect(mocks.globalEventService.publishNoteStream).not.toHaveBeenCalled();
		expect(mocks.apRendererService.renderDelete).not.toHaveBeenCalled();
		expect(mocks.notesRepository.delete).toHaveBeenCalled();
	});

	test('delete local-only note does not deliver delete activity', async () => {
		const { service, mocks } = createService();
		const user = createUser();
		const note = createNote({ localOnly: true });

		await service.delete(user, note);

		expect(mocks.apRendererService.renderDelete).not.toHaveBeenCalled();
	});

	test('delete renote delivers Undo Announce activity', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'renote1', uri: 'https://remote.example/notes/renote1', mentionedRemoteUsers: '[]' } as any);
		const user = createUser();
		const note = createNote({ renoteId: 'renote1', text: null, hasPoll: false, fileIds: [] });

		await service.delete(user, note);

		expect(mocks.apRendererService.renderUndo).toHaveBeenCalled();
		expect(mocks.apRendererService.renderAnnounce).toHaveBeenCalled();
	});

	test('delete remote user decrements instance notesCount', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.isLocalUser.mockReturnValue(false);
		mocks.userEntityService.isRemoteUser.mockReturnValue(true);
		mocks.metaService.fetch.mockResolvedValue({ enableChartsForRemoteUser: true, enableChartsForFederatedInstances: true } as any);
		const user = createUser({ host: 'remote.example' });
		const note = createNote();

		await service.delete(user, note);

		expect(mocks.federatedInstanceService.fetch).toHaveBeenCalledWith('remote.example');
		expect(mocks.instancesRepository.decrement).toHaveBeenCalled();
		expect(mocks.instanceChart.updateNote).toHaveBeenCalled();
	});

	test('delete finds and unindexes cascading notes', async () => {
		const { service, mocks } = createService();
		const replyNote = {
			id: 'reply1',
			userId: 'user1',
			replyId: 'note1',
			mentionedRemoteUsers: '[]',
			user: { host: null },
			localOnly: false,
			userHost: null,
		} as any;
		mocks.notesRepository.createQueryBuilder.mockReturnValue({
			where: jest.fn().mockReturnThis(),
			orWhere: jest.fn().mockReturnThis(),
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			getMany: jest.fn()
				.mockResolvedValueOnce([replyNote])
				.mockResolvedValueOnce([]),
		});
		const user = createUser();
		const note = createNote();

		await service.delete(user, note);

		expect(mocks.searchService.unindexNote).toHaveBeenCalledWith(replyNote);
	});

	test('delete skips renote decrement when same renotes exist', async () => {
		const { service, mocks } = createService();
		mocks.noteEntityService.countSameRenotes.mockResolvedValue(1);
		const user = createUser();
		const note = createNote({ renoteId: 'renote1' });

		await service.delete(user, note);

		expect(mocks.notesRepository.decrement).not.toHaveBeenCalled();
	});

	test('delete skips score decrement for bot user', async () => {
		const { service, mocks } = createService();
		const user = createUser({ isBot: true });
		const note = createNote({ renoteId: 'renote1' });

		await service.delete(user, note);

		expect(mocks.notesRepository.decrement).toHaveBeenCalledWith({ id: 'renote1' }, 'renoteCount', 1);
		expect(mocks.notesRepository.decrement).not.toHaveBeenCalledWith({ id: 'renote1' }, 'score', 1);
	});

	test('delete delivers to mentioned remote users', async () => {
		const { service, mocks } = createService();
		mocks.usersRepository.find.mockResolvedValue([{ id: 'remote1', host: 'remote.example', inbox: 'https://remote.example/inbox' }] as any);
		const user = createUser();
		const note = createNote({ mentionedRemoteUsers: JSON.stringify([{ uri: 'https://remote.example/users/remote1', username: 'remote1', url: 'https://remote.example/@remote1' }]) });

		await service.delete(user, note);

		expect(mocks.apDeliverManagerService.deliverToUser).toHaveBeenCalled();
	});

	test('delete skips remote user charts when disabled', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.isLocalUser.mockReturnValue(false);
		mocks.userEntityService.isRemoteUser.mockReturnValue(true);
		mocks.metaService.fetch.mockResolvedValue({ enableChartsForRemoteUser: false, enableChartsForFederatedInstances: false } as any);
		const user = createUser({ host: 'remote.example' });
		const note = createNote();

		await service.delete(user, note);

		expect(mocks.perUserNotesChart.update).not.toHaveBeenCalled();
	});

	test('delete skips cascading note delivery when user is remote', async () => {
		const { service, mocks } = createService();
		const replyNote = {
			id: 'reply1',
			userId: 'user1',
			replyId: 'note1',
			mentionedRemoteUsers: '[]',
			user: { host: 'remote.example' },
			localOnly: false,
			userHost: 'remote.example',
		} as any;
		mocks.notesRepository.createQueryBuilder.mockReturnValue({
			where: jest.fn().mockReturnThis(),
			orWhere: jest.fn().mockReturnThis(),
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			getMany: jest.fn()
				.mockResolvedValueOnce([replyNote])
				.mockResolvedValueOnce([]),
		});
		const user = createUser();
		const note = createNote();

		await service.delete(user, note);

		expect(mocks.apDeliverManagerService.deliverToFollowers).toHaveBeenCalledTimes(1);
	});

	test('delete remote user does not deliver local delete activity', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.isLocalUser.mockReturnValue(false);
		mocks.userEntityService.isRemoteUser.mockReturnValue(true);
		const user = createUser({ host: 'remote.example' });
		const note = createNote({ localOnly: false });

		await service.delete(user, note);

		expect(mocks.apRendererService.renderDelete).not.toHaveBeenCalled();
		expect(mocks.apRendererService.renderUndo).not.toHaveBeenCalled();
	});

	test('delete note with text delivers Delete not Undo Announce', async () => {
		const { service, mocks } = createService();
		mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'renote1', uri: 'https://remote.example/notes/renote1', mentionedRemoteUsers: '[]' } as any);
		const user = createUser();
		const note = createNote({ renoteId: 'renote1', text: 'quote text', hasPoll: false, fileIds: [] });

		await service.delete(user, note);

		expect(mocks.apRendererService.renderDelete).toHaveBeenCalled();
		expect(mocks.apRendererService.renderUndo).not.toHaveBeenCalled();
	});

	test('delete skips local-only cascading notes', async () => {
		const { service, mocks } = createService();
		const replyNote = {
			id: 'reply1',
			userId: 'user1',
			replyId: 'note1',
			mentionedRemoteUsers: '[]',
			user: { host: null },
			localOnly: true,
			userHost: null,
		} as any;
		mocks.notesRepository.createQueryBuilder.mockReturnValue({
			where: jest.fn().mockReturnThis(),
			orWhere: jest.fn().mockReturnThis(),
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			getMany: jest.fn()
				.mockResolvedValueOnce([replyNote])
				.mockResolvedValueOnce([]),
		});
		const user = createUser();
		const note = createNote();

		await service.delete(user, note);

		expect(mocks.apDeliverManagerService.deliverToFollowers).toHaveBeenCalledTimes(1);
	});

	test('delete skips cascading notes from remote users', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.isLocalUser.mockImplementation(user => user != null && (user as any).host == null);
		const replyNote = {
			id: 'reply1',
			userId: 'user1',
			replyId: 'note1',
			mentionedRemoteUsers: '[]',
			user: { host: 'remote.example' },
			localOnly: false,
			userHost: null,
		} as any;
		mocks.notesRepository.createQueryBuilder.mockReturnValue({
			where: jest.fn().mockReturnThis(),
			orWhere: jest.fn().mockReturnThis(),
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			getMany: jest.fn()
				.mockResolvedValueOnce([replyNote])
				.mockResolvedValueOnce([]),
		});
		const user = createUser();
		const note = createNote();

		await service.delete(user, note);

		expect(mocks.apDeliverManagerService.deliverToFollowers).toHaveBeenCalledTimes(1);
	});

	test('delete delivers to renote user as mentioned remote user', async () => {
		const { service, mocks } = createService();
		mocks.usersRepository.find.mockResolvedValue([{ id: 'renoteuser', host: 'remote.example', inbox: 'https://remote.example/inbox' }] as any);
		const user = createUser();
		const note = createNote({ renoteUserId: 'renoteuser', mentionedRemoteUsers: '[]' });

		await service.delete(user, note);

		expect(mocks.apDeliverManagerService.deliverToUser).toHaveBeenCalled();
	});
});
