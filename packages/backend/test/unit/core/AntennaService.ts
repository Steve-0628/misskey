process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { AntennaService } from '@/core/AntennaService.js';
import type Redis from 'ioredis';
import type { MutingsRepository, NotesRepository, AntennasRepository, UserListJoiningsRepository, FollowingsRepository } from '@/models/index.js';
import type { UtilityService } from '@/core/UtilityService.js';
import type { IdService } from '@/core/IdService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { AntennaEntityService } from '@/core/entities/AntennaEntityService.js';
import type { Antenna } from '@/models/entities/Antenna.js';
import type { Note } from '@/models/entities/Note.js';
import type { User } from '@/models/entities/User.js';

function createRedis(): jest.Mocked<Redis.Redis> {
	return {
		on: jest.fn().mockReturnThis(),
		off: jest.fn().mockReturnThis(),
		pipeline: jest.fn().mockReturnValue({
			xadd: jest.fn().mockReturnThis(),
			exec: jest.fn().mockResolvedValue([]),
		}),
	} as unknown as jest.Mocked<Redis.Redis>;
}

function createAntenna(data: Partial<Antenna> = {}): Antenna {
	return {
		id: 'antenna1',
		userId: 'user1',
		name: 'test',
		src: 'all',
		keywords: [],
		excludeKeywords: [],
		caseSensitive: false,
		withReplies: false,
		withFile: false,
		isActive: true,
		...data,
	} as unknown as Antenna;
}

function createNote(data: Partial<Note> = {}): Note {
	return {
		id: 'note1',
		userId: 'user2',
		visibility: 'public',
		text: 'hello world',
		...data,
	} as unknown as Note;
}

function createNoteUser(data: Partial<User> = {}): any {
	return {
		id: 'user2',
		username: 'bob',
		host: null,
		...data,
	};
}

function createService() {
	const redisClient = createRedis();
	const redisForSub = createRedis();

	const antennasRepository = {
		findBy: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<AntennasRepository>;

	const mutingsRepository = {} as unknown as MutingsRepository;
	const notesRepository = {} as unknown as NotesRepository;
	const userListJoiningsRepository = {
		findBy: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<UserListJoiningsRepository>;
	const followingsRepository = {
		count: jest.fn().mockResolvedValue(0),
	} as unknown as jest.Mocked<FollowingsRepository>;

	const utilityService = {
		getFullApAccount: jest.fn().mockImplementation((username: string, host: string | null) => host ? `${username}@${host}`.toLowerCase() : username.toLowerCase()),
	} as unknown as jest.Mocked<UtilityService>;

	const idService = {} as unknown as IdService;

	const globalEventService = {
		publishAntennaStream: jest.fn(),
	} as unknown as GlobalEventService;

	const noteEntityService = {} as unknown as NoteEntityService;
	const antennaEntityService = {} as unknown as AntennaEntityService;

	const service = new AntennaService(
		redisClient,
		redisForSub,
		mutingsRepository,
		notesRepository,
		antennasRepository,
		userListJoiningsRepository,
		followingsRepository,
		utilityService,
		idService,
		globalEventService,
		noteEntityService,
		antennaEntityService,
	);

	return {
		service,
		mocks: {
			redisClient,
			redisForSub,
			antennasRepository,
			userListJoiningsRepository,
			followingsRepository,
			utilityService,
			globalEventService,
		},
	};
}

describe('AntennaService', () => {
	describe('checkHitAntenna', () => {
		test('matches public note by default', async () => {
			const { service } = createService();
			const antenna = createAntenna();
			const note = createNote();

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(true);
		});

		test('specified visibility excludes non-visible user', async () => {
			const { service } = createService();
			const antenna = createAntenna({ userId: 'user1' });
			const note = createNote({ visibility: 'specified', visibleUserIds: ['user3'] });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});

		test('specified visibility includes author', async () => {
			const { service } = createService();
			const antenna = createAntenna({ userId: 'user1' });
			const note = createNote({ visibility: 'specified', userId: 'user1' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser({ id: 'user1' }));

			expect(hit).toBe(true);
		});

		test('followers visibility requires following', async () => {
			const { service, mocks } = createService();
			mocks.followingsRepository.count.mockResolvedValue(0);
			const antenna = createAntenna({ userId: 'user1' });
			const note = createNote({ visibility: 'followers' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
			expect(mocks.followingsRepository.count).toHaveBeenCalled();
		});

		test('followers visibility passes when following', async () => {
			const { service, mocks } = createService();
			mocks.followingsRepository.count.mockResolvedValue(1);
			const antenna = createAntenna({ userId: 'user1' });
			const note = createNote({ visibility: 'followers' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(true);
		});

		test('withReplies false excludes replies', async () => {
			const { service } = createService();
			const antenna = createAntenna({ withReplies: false });
			const note = createNote({ replyId: 'reply1' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});

		test('withReplies true includes replies', async () => {
			const { service } = createService();
			const antenna = createAntenna({ withReplies: true });
			const note = createNote({ replyId: 'reply1' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(true);
		});

		test('list source requires note user in list', async () => {
			const { service, mocks } = createService();
			mocks.userListJoiningsRepository.findBy.mockResolvedValue([{ userId: 'user3' }] as any);
			const antenna = createAntenna({ src: 'list', userListId: 'list1' });
			const note = createNote();

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});

		test('users source requires matching acct', async () => {
			const { service } = createService();
			const antenna = createAntenna({ src: 'users', users: ['alice@remote.example'] });
			const note = createNote();

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser({ host: 'remote.example' }));

			expect(hit).toBe(false);
		});

		test('keyword match is case-insensitive by default', async () => {
			const { service } = createService();
			const antenna = createAntenna({ keywords: [['HELLO']] });
			const note = createNote({ text: 'Hello world' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(true);
		});

		test('keyword match is case-sensitive when set', async () => {
			const { service } = createService();
			const antenna = createAntenna({ keywords: [['HELLO']], caseSensitive: true });
			const note = createNote({ text: 'hello world' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});

		test('exclude keyword rejects matching note', async () => {
			const { service } = createService();
			const antenna = createAntenna({ excludeKeywords: [['hello']] });
			const note = createNote({ text: 'hello world' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});

		test('withFile requires fileIds', async () => {
			const { service } = createService();
			const antenna = createAntenna({ withFile: true });
			const note = createNote({ fileIds: [] });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});

		test('withFile passes when fileIds present', async () => {
			const { service } = createService();
			const antenna = createAntenna({ withFile: true });
			const note = createNote({ fileIds: ['file1'] });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(true);
		});

		test('home source matches any public note', async () => {
			const { service } = createService();
			const antenna = createAntenna({ src: 'home' });
			const note = createNote();

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(true);
		});

		test('empty keywords after cleanup do not reject', async () => {
			const { service } = createService();
			const antenna = createAntenna({ keywords: [['']] });
			const note = createNote({ text: 'hello' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(true);
		});

		test('keyword match works against cw only', async () => {
			const { service } = createService();
			const antenna = createAntenna({ keywords: [['spoiler']] });
			const note = createNote({ text: null, cw: 'spoiler alert' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(true);
		});

		test('exclude keyword match works against cw only', async () => {
			const { service } = createService();
			const antenna = createAntenna({ excludeKeywords: [['spoiler']] });
			const note = createNote({ text: null, cw: 'spoiler alert' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});
	});

	test('getAntennas fetches from repository only once', async () => {
		const { service, mocks } = createService();
		mocks.antennasRepository.findBy.mockResolvedValue([createAntenna()]);

		const a1 = await service.getAntennas();
		const a2 = await service.getAntennas();

		expect(mocks.antennasRepository.findBy).toHaveBeenCalledTimes(1);
		expect(a1).toHaveLength(1);
		expect(a1).toBe(a2);
	});

	test('addNoteToAntennas adds matched notes to timeline', async () => {
		const { service, mocks } = createService();
		mocks.antennasRepository.findBy.mockResolvedValue([createAntenna({ keywords: [['hello']] })]);
		const note = createNote({ text: 'hello' });

		await service.addNoteToAntennas(note, createNoteUser());

		expect(mocks.redisClient.pipeline).toHaveBeenCalled();
		expect(mocks.globalEventService.publishAntennaStream).toHaveBeenCalledWith('antenna1', 'note', note);
	});

	describe('onRedisMessage', () => {
		test('antennaCreated adds to antennas', async () => {
			const { service } = createService();
			await service.getAntennas();
			(service as any).onRedisMessage('internal', JSON.stringify({
				channel: 'internal',
				message: { type: 'antennaCreated', body: { id: 'antenna2', createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() } },
			}));

			const antennas = await service.getAntennas();
			expect(antennas.some(a => a.id === 'antenna2')).toBe(true);
		});

		test('antennaUpdated replaces antenna', async () => {
			const { service } = createService();
			await service.getAntennas();
			(service as any).onRedisMessage('internal', JSON.stringify({
				channel: 'internal',
				message: { type: 'antennaCreated', body: { id: 'antenna1', name: 'original', createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() } },
			}));
			(service as any).onRedisMessage('internal', JSON.stringify({
				channel: 'internal',
				message: { type: 'antennaUpdated', body: { id: 'antenna1', name: 'updated', createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() } },
			}));

			const antennas = await service.getAntennas();
			expect(antennas.find(a => a.id === 'antenna1')!.name).toBe('updated');
		});

		test('ignores non-internal channels', async () => {
			const { service } = createService();
			await service.getAntennas();
			(service as any).onRedisMessage('other', JSON.stringify({
				channel: 'other',
				message: { type: 'antennaCreated', body: { id: 'antenna2' } },
			}));

			const antennas = await service.getAntennas();
			expect(antennas.some(a => a.id === 'antenna2')).toBe(false);
		});

		test('ignores unknown internal message type', async () => {
			const { service } = createService();
			await service.getAntennas();
			(service as any).onRedisMessage('internal', JSON.stringify({
				channel: 'internal',
				message: { type: 'unknown', body: {} },
			}));

			const antennas = await service.getAntennas();
			expect(antennas).toHaveLength(0);
		});

		test('antennaDeleted removes antenna', async () => {
			const { service } = createService();
			await service.getAntennas();
			(service as any).onRedisMessage('internal', JSON.stringify({
				channel: 'internal',
				message: { type: 'antennaCreated', body: { id: 'antenna1', createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() } },
			}));
			(service as any).onRedisMessage('internal', JSON.stringify({
				channel: 'internal',
				message: { type: 'antennaDeleted', body: { id: 'antenna1' } },
			}));

			const antennas = await service.getAntennas();
			expect(antennas.some(a => a.id === 'antenna1')).toBe(false);
		});
	});

	test('dispose removes listener', () => {
		const { service, mocks } = createService();
		service.dispose();
		expect(mocks.redisForSub.off).toHaveBeenCalled();
	});

	describe('checkHitAntenna', () => {
		test('specified visibility rejects when visibleUserIds is null', async () => {
			const { service } = createService();
			const antenna = createAntenna({ userId: 'user1' });
			const note = createNote({ visibility: 'specified', userId: 'user2', visibleUserIds: null });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});

		test('followers visibility allows own note without following', async () => {
			const { service, mocks } = createService();
			mocks.followingsRepository.count.mockResolvedValue(0);
			const antenna = createAntenna({ userId: 'user1' });
			const note = createNote({ visibility: 'followers', userId: 'user1' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser({ id: 'user1' }));

			expect(hit).toBe(true);
		});

		test('users source matches when acct equals', async () => {
			const { service } = createService();
			const antenna = createAntenna({ src: 'users', users: ['bob@remote.example'] });
			const note = createNote({ userId: 'user2' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser({ username: 'bob', host: 'remote.example' }));

			expect(hit).toBe(true);
		});

		test('keywords OR logic matches second group', async () => {
			const { service } = createService();
			const antenna = createAntenna({ keywords: [['foo'], ['bar']] });
			const note = createNote({ text: 'bar baz' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(true);
		});

		test('exclude keywords OR logic rejects on second group', async () => {
			const { service } = createService();
			const antenna = createAntenna({ excludeKeywords: [['foo'], ['bar']] });
			const note = createNote({ text: 'bar baz' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});

		test('keywords require all words in AND group', async () => {
			const { service } = createService();
			const antenna = createAntenna({ keywords: [['hello', 'world']] });
			const note = createNote({ text: 'hello' });

			const hit = await service.checkHitAntenna(antenna, note, createNoteUser());

			expect(hit).toBe(false);
		});
	});
});
