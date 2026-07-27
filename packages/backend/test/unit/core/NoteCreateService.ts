process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import type { Config } from '@/config.js';
import type { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import type { InstancesRepository, MutedNotesRepository, MutingsRepository, NotesRepository, NoteThreadMutingsRepository, UserProfilesRepository, UsersRepository } from '@/models/index.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { IdService } from '@/core/IdService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { QueueService } from '@/core/QueueService.js';
import type { NoteReadService } from '@/core/NoteReadService.js';
import type { NotificationService } from '@/core/NotificationService.js';
import type { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import type { HashtagService } from '@/core/HashtagService.js';
import type { AntennaService } from '@/core/AntennaService.js';
import type { WebhookService } from '@/core/WebhookService.js';
import type { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import type { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import type { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import type { RoleService } from '@/core/RoleService.js';
import type { MetaService } from '@/core/MetaService.js';
import type { SearchService } from '@/core/SearchService.js';
import type NotesChart from '@/core/chart/charts/notes.js';
import type PerUserNotesChart from '@/core/chart/charts/per-user-notes.js';
import type InstanceChart from '@/core/chart/charts/instance.js';
import type ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { Note } from '@/models/entities/Note.js';

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const db = {} as unknown as DataSource;
	const redisClient = {} as unknown as Redis.Redis;

	const usersRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
		createQueryBuilder: jest.fn().mockReturnValue({
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue(undefined),
		}),
	} as unknown as jest.Mocked<UsersRepository>;

	const notesRepository = {
		insert: jest.fn().mockResolvedValue(undefined),
		createQueryBuilder: jest.fn().mockReturnValue({
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue(undefined),
		}),
		increment: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<NotesRepository>;

	const mutingsRepository = {} as unknown as jest.Mocked<MutingsRepository>;
	const instancesRepository = {} as unknown as jest.Mocked<InstancesRepository>;
	const userProfilesRepository = {} as unknown as jest.Mocked<UserProfilesRepository>;
	const mutedNotesRepository = {} as unknown as jest.Mocked<MutedNotesRepository>;
	const noteThreadMutingsRepository = {} as unknown as jest.Mocked<NoteThreadMutingsRepository>;
	const userEntityService = {} as unknown as jest.Mocked<UserEntityService>;
	const noteEntityService = {} as unknown as jest.Mocked<NoteEntityService>;
	const idService = {} as unknown as IdService;
	const globalEventService = {} as unknown as GlobalEventService;
	const queueService = {} as unknown as QueueService;
	const noteReadService = {} as unknown as NoteReadService;
	const notificationService = {} as unknown as NotificationService;
	const federatedInstanceService = {} as unknown as FederatedInstanceService;
	const hashtagService = {} as unknown as HashtagService;
	const antennaService = {} as unknown as AntennaService;
	const webhookService = {} as unknown as WebhookService;
	const remoteUserResolveService = {
		resolveUser: jest.fn().mockResolvedValue(null),
	} as unknown as RemoteUserResolveService;
	const apDeliverManagerService = {} as unknown as ApDeliverManagerService;

	const apRendererService = {
		renderAnnounce: jest.fn().mockReturnValue({ type: 'Announce' }),
		renderCreate: jest.fn().mockReturnValue({ type: 'Create' }),
		renderNote: jest.fn().mockResolvedValue({ type: 'Note' }),
		addContext: jest.fn().mockImplementation(x => x),
	} as unknown as ApRendererService;

	const roleService = {} as unknown as RoleService;
	const metaService = {} as unknown as MetaService;

	const searchService = {
		indexNote: jest.fn(),
	} as unknown as SearchService;

	const notesChart = {} as unknown as NotesChart;
	const perUserNotesChart = {} as unknown as PerUserNotesChart;
	const instanceChart = {} as unknown as InstanceChart;
	const activeUsersChart = {} as unknown as ActiveUsersChart;

	const service = new NoteCreateService(
		config,
		db,
		redisClient,
		usersRepository,
		notesRepository,
		mutingsRepository,
		instancesRepository,
		userProfilesRepository,
		mutedNotesRepository,
		noteThreadMutingsRepository,
		userEntityService,
		noteEntityService,
		idService,
		globalEventService,
		queueService,
		noteReadService,
		notificationService,
		federatedInstanceService,
		hashtagService,
		antennaService,
		webhookService,
		remoteUserResolveService,
		apDeliverManagerService,
		apRendererService,
		roleService,
		metaService,
		searchService,
		notesChart,
		perUserNotesChart,
		activeUsersChart,
		instanceChart,
	);

	return { service, mocks: { usersRepository, notesRepository, apRendererService, searchService, remoteUserResolveService } };
}

function createNote(data: Partial<Note> = {}): Note {
	return {
		id: 'note1',
		userId: 'user1',
		userHost: null,
		visibility: 'public',
		localOnly: false,
		text: null,
		cw: null,
		threadId: null,
		...data,
	} as unknown as Note;
}

describe('NoteCreateService private helpers', () => {
	test('isSensitive detects plain keyword', async () => {
		const { service } = createService();
		const result = await (service as any).isSensitive({ text: 'hello sensitive world' }, ['sensitive']);
		expect(result).toBe(true);
	});

	test('isSensitive detects multi-word keyword', async () => {
		const { service } = createService();
		const result = await (service as any).isSensitive({ text: 'hello bad world' }, ['bad world']);
		expect(result).toBe(true);
	});

	test('isSensitive returns false when no sensitive words', async () => {
		const { service } = createService();
		const result = await (service as any).isSensitive({ text: 'hello world' }, ['sensitive']);
		expect(result).toBe(false);
	});

	test('isSensitive returns false for empty text and words', async () => {
		const { service } = createService();
		const result = await (service as any).isSensitive({ text: null, cw: null }, ['sensitive']);
		expect(result).toBe(false);
	});

	test('isSensitive matches regex pattern', async () => {
		const { service } = createService();
		const result = await (service as any).isSensitive({ text: 'hello world' }, ['/wor.d/']);
		expect(result).toBe(true);
	});

	test('index skips note without text or cw', async () => {
		const { service, mocks } = createService();
		const note = createNote({ text: null, cw: null });
		(service as any).index(note);
		expect(mocks.searchService.indexNote).not.toHaveBeenCalled();
	});

	test('index calls searchService when text present', async () => {
		const { service, mocks } = createService();
		const note = createNote({ text: 'hello' });
		(service as any).index(note);
		expect(mocks.searchService.indexNote).toHaveBeenCalledWith(note);
	});

	test('index calls searchService when cw present', async () => {
		const { service, mocks } = createService();
		const note = createNote({ text: null, cw: 'spoiler' });
		(service as any).index(note);
		expect(mocks.searchService.indexNote).toHaveBeenCalledWith(note);
	});

	test('renderNoteOrRenoteActivity returns null for localOnly note', async () => {
		const { service } = createService();
		const note = createNote({ localOnly: true });
		const result = await (service as any).renderNoteOrRenoteActivity({ localOnly: true }, note);
		expect(result).toBeNull();
	});

	test('renderNoteOrRenoteActivity renders Announce for pure renote', async () => {
		const { service, mocks } = createService();
		const renote = createNote({ uri: 'https://remote.example/note1' });
		const note = createNote({ renote });
		const result = await (service as any).renderNoteOrRenoteActivity({ renote, text: null, poll: null, files: null }, note);
		expect(mocks.apRendererService.renderAnnounce).toHaveBeenCalled();
		expect(result).toEqual({ type: 'Announce' });
	});

	test('renderNoteOrRenoteActivity renders Create for note with text', async () => {
		const { service, mocks } = createService();
		const note = createNote({ text: 'hello' });
		const result = await (service as any).renderNoteOrRenoteActivity({ text: 'hello', renote: null, poll: null, files: null }, note);
		expect(mocks.apRendererService.renderCreate).toHaveBeenCalled();
		expect(result).toEqual({ type: 'Create' });
	});

	test('incNotesCountOfUser updates repository', async () => {
		const { service, mocks } = createService();
		(service as any).incNotesCountOfUser({ id: 'user1' });
		expect(mocks.usersRepository.createQueryBuilder).toHaveBeenCalled();
	});

	test('saveReply increments replies count', async () => {
		const { service, mocks } = createService();
		const reply = createNote({ id: 'reply1' });
		const note = createNote();
		(service as any).saveReply(reply, note);
		expect(mocks.notesRepository.increment).toHaveBeenCalledWith({ id: 'reply1' }, 'repliesCount', 1);
	});

	test('incRenoteCount updates renote count', async () => {
		const { service, mocks } = createService();
		const renote = createNote({ id: 'renote1' });
		(service as any).incRenoteCount(renote);
		expect(mocks.notesRepository.createQueryBuilder).toHaveBeenCalled();
	});

	test('extractMentionedUsers returns empty for null tokens', async () => {
		const { service } = createService();
		const result = await (service as any).extractMentionedUsers({ host: null }, null);
		expect(result).toEqual([]);
	});

	test('extractMentionedUsers deduplicates resolved users', async () => {
		const { service, mocks } = createService();
		const u1 = { id: 'u1', host: 'remote.example', username: 'alice', uri: 'https://remote.example/u1' };
		mocks.remoteUserResolveService.resolveUser.mockResolvedValue(u1);
		const result = await (service as any).extractMentionedUsers(
			{ host: null },
			[{ type: 'mention', props: { username: 'alice', host: 'remote.example', acct: 'alice@remote.example' } }],
		);
		expect(result).toEqual([u1]);
	});
});

