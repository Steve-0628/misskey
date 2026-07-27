process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { SearchService } from '@/core/SearchService.js';
import { DI } from '@/di-symbols.js';
import { QueryService } from '@/core/QueryService.js';
import { IdService } from '@/core/IdService.js';
import { User } from '@/models/entities/User.js';
import type { NotesRepository } from '@/models/index.js';
import type { Note } from '@/models/entities/Note.js';
import type { Config } from '@/config.js';
import type { MeiliSearch } from 'meilisearch';
import type { SelectQueryBuilder } from 'typeorm';
import type { TestingModule } from '@nestjs/testing';

function createNote(data: Partial<Note> = {}): Note {
	return {
		id: 'note1',
		createdAt: new Date('2024-01-01T00:00:00.000Z'),
		userId: 'user1',
		userHost: null,
		text: 'hello world',
		cw: null,
		visibility: 'public',
		...data,
	} as Note;
}

function createUser(data: Partial<User> = {}): User {
	return new User({
		id: 'user1',
		createdAt: new Date(),
		username: 'alice',
		usernameLower: 'alice',
		host: null,
		...data,
	});
}

function createQueryBuilder() {
	return {
		andWhere: jest.fn().mockReturnThis(),
		innerJoinAndSelect: jest.fn().mockReturnThis(),
		leftJoinAndSelect: jest.fn().mockReturnThis(),
		orderBy: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		getMany: jest.fn().mockResolvedValue([]),
		getOne: jest.fn().mockResolvedValue(null),
	} as unknown as SelectQueryBuilder<Note>;
}

function createMeiliIndex() {
	return {
		updateSettings: jest.fn().mockResolvedValue(undefined),
		search: jest.fn().mockResolvedValue({ hits: [] }),
		addDocuments: jest.fn().mockResolvedValue(undefined),
		deleteDocument: jest.fn().mockResolvedValue(undefined),
	};
}

describe('SearchService', () => {
	let app: TestingModule;
	let searchService: SearchService;
	let notesRepository: jest.Mocked<NotesRepository>;
	let queryService: jest.Mocked<QueryService>;
	let idService: jest.Mocked<IdService>;
	let meiliIndex: ReturnType<typeof createMeiliIndex>;

	async function setupModule(meilisearch: MeiliSearch | null, configOverrides: Partial<Config> = {}) {
		meiliIndex = createMeiliIndex();
		const meilisearchClient = meilisearch
			? ({ index: jest.fn().mockReturnValue(meiliIndex) } as unknown as MeiliSearch)
			: null;

		notesRepository = {
			createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilder()),
		} as unknown as jest.Mocked<NotesRepository>;

		queryService = {
			makePaginationQuery: jest.fn().mockImplementation((q) => q),
			generateVisibilityQuery: jest.fn(),
			generateMutedUserQuery: jest.fn(),
			generateBlockedUserQuery: jest.fn(),
		} as unknown as jest.Mocked<QueryService>;

		idService = {
			parse: jest.fn().mockReturnValue({ date: new Date('2024-01-01T00:00:00.000Z') }),
			genId: jest.fn().mockReturnValue('id1'),
		} as unknown as jest.Mocked<IdService>;

		const config = {
			host: 'example.com',
			url: 'https://example.com',
			id: 'aid',
			...configOverrides,
		} as Config;

		app = await Test.createTestingModule({
			providers: [
				SearchService,
				{ provide: DI.config, useValue: config },
				{ provide: DI.meilisearch, useValue: meilisearchClient },
				{ provide: DI.notesRepository, useValue: notesRepository },
				{ provide: QueryService, useValue: queryService },
				{ provide: IdService, useValue: idService },
			],
		}).compile();

		searchService = app.get<SearchService>(SearchService);
	}

	afterEach(async () => {
		await app.close();
	});

	describe('indexNote', () => {
		test('does nothing when meilisearch is disabled', async () => {
			await setupModule(null);

			await searchService.indexNote(createNote());

			expect(meiliIndex.addDocuments).not.toHaveBeenCalled();
		});

		test('does nothing when note has no text and no cw', async () => {
			await setupModule({ index: jest.fn().mockReturnValue(createMeiliIndex()) } as unknown as MeiliSearch, {
				meilisearch: { host: 'localhost', port: '7700', apiKey: '', index: 'test' },
			});

			await searchService.indexNote(createNote({ text: null, cw: null }));

			expect(meiliIndex.addDocuments).not.toHaveBeenCalled();
		});

		test('adds document for global scope', async () => {
			await setupModule({ index: jest.fn().mockReturnValue(createMeiliIndex()) } as unknown as MeiliSearch, {
				meilisearch: { host: 'localhost', port: '7700', apiKey: '', index: 'test', scope: 'global' },
			});

			await searchService.indexNote(createNote({ userHost: 'remote.example.com' }));

			expect(meiliIndex.addDocuments).toHaveBeenCalledWith(
				[expect.objectContaining({ id: 'note1', text: 'hello world' })],
				{ primaryKey: 'id' },
			);
		});

		test('adds document for local scope when note is local', async () => {
			await setupModule({ index: jest.fn().mockReturnValue(createMeiliIndex()) } as unknown as MeiliSearch, {
				meilisearch: { host: 'localhost', port: '7700', apiKey: '', index: 'test', scope: 'local' },
			});

			await searchService.indexNote(createNote({ userHost: null }));

			expect(meiliIndex.addDocuments).toHaveBeenCalledWith(
				[expect.objectContaining({ id: 'note1', userHost: null })],
				{ primaryKey: 'id' },
			);
		});

		test('skips document for local scope when note is remote', async () => {
			await setupModule({ index: jest.fn().mockReturnValue(createMeiliIndex()) } as unknown as MeiliSearch, {
				meilisearch: { host: 'localhost', port: '7700', apiKey: '', index: 'test', scope: 'local' },
			});

			await searchService.indexNote(createNote({ userHost: 'remote.example.com' }));

			expect(meiliIndex.addDocuments).not.toHaveBeenCalled();
		});

		test('adds document for host array scope when host matches', async () => {
			await setupModule({ index: jest.fn().mockReturnValue(createMeiliIndex()) } as unknown as MeiliSearch, {
				meilisearch: { host: 'localhost', port: '7700', apiKey: '', index: 'test', scope: ['allowed.example.com'] },
			});

			await searchService.indexNote(createNote({ userHost: 'allowed.example.com' }));

			expect(meiliIndex.addDocuments).toHaveBeenCalledWith(
				[expect.objectContaining({ id: 'note1', userHost: 'allowed.example.com' })],
				{ primaryKey: 'id' },
			);
		});

		test('skips document for host array scope when host does not match', async () => {
			await setupModule({ index: jest.fn().mockReturnValue(createMeiliIndex()) } as unknown as MeiliSearch, {
				meilisearch: { host: 'localhost', port: '7700', apiKey: '', index: 'test', scope: ['allowed.example.com'] },
			});

			await searchService.indexNote(createNote({ userHost: 'other.example.com' }));

			expect(meiliIndex.addDocuments).not.toHaveBeenCalled();
		});
	});

	describe('unindexNote', () => {
		test('does nothing when meilisearch is disabled', async () => {
			await setupModule(null);

			await searchService.unindexNote(createNote());

			expect(meiliIndex.deleteDocument).not.toHaveBeenCalled();
		});

		test('does nothing when note visibility is not public or home', async () => {
			await setupModule({ index: jest.fn().mockReturnValue(createMeiliIndex()) } as unknown as MeiliSearch, {
				meilisearch: { host: 'localhost', port: '7700', apiKey: '', index: 'test' },
			});

			await searchService.unindexNote(createNote({ visibility: 'followers' }));

			expect(meiliIndex.deleteDocument).not.toHaveBeenCalled();
		});

		test('deletes document for public note', async () => {
			await setupModule({ index: jest.fn().mockReturnValue(createMeiliIndex()) } as unknown as MeiliSearch, {
				meilisearch: { host: 'localhost', port: '7700', apiKey: '', index: 'test' },
			});

			await searchService.unindexNote(createNote({ visibility: 'public' }));

			expect(meiliIndex.deleteDocument).toHaveBeenCalledWith('note1');
		});
	});

	describe('searchNote without meilisearch', () => {
		beforeEach(async () => {
			await setupModule(null);
		});

		test('searches notes with SQL fallback', async () => {
			const note = createNote();
			const queryBuilder = createQueryBuilder();
			(queryBuilder.getMany as jest.Mock).mockResolvedValue([note]);
			(notesRepository.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);

			const result = await searchService.searchNote('hello', null, {}, { limit: 10 });

			expect(result).toEqual([note]);
			expect(queryService.makePaginationQuery).toHaveBeenCalledWith(queryBuilder, undefined, undefined);
			expect(queryBuilder.andWhere).toHaveBeenCalledWith('note.text ILIKE :q', { q: '%hello%' });
			expect(queryBuilder.limit).toHaveBeenCalledWith(10);
		});

		test('applies visibility and muted/blocked queries when me is provided', async () => {
			const me = createUser();
			const queryBuilder = createQueryBuilder();
			(notesRepository.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);

			await searchService.searchNote('hello', me, {}, { limit: 10 });

			expect(queryService.generateVisibilityQuery).toHaveBeenCalledWith(queryBuilder, me);
			expect(queryService.generateMutedUserQuery).toHaveBeenCalledWith(queryBuilder, me);
			expect(queryService.generateBlockedUserQuery).toHaveBeenCalledWith(queryBuilder, me);
		});

		test('filters by userId', async () => {
			const queryBuilder = createQueryBuilder();
			(notesRepository.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);

			await searchService.searchNote('hello', null, { userId: 'user2' }, { limit: 10 });

			expect(queryBuilder.andWhere).toHaveBeenCalledWith('note.userId = :userId', { userId: 'user2' });
		});

		test('applies pagination', async () => {
			const queryBuilder = createQueryBuilder();
			(notesRepository.createQueryBuilder as jest.Mock).mockReturnValue(queryBuilder);

			await searchService.searchNote('hello', null, {}, { sinceId: 'since1', untilId: 'until1', limit: 5 });

			expect(queryService.makePaginationQuery).toHaveBeenCalledWith(queryBuilder, 'since1', 'until1');
			expect(queryBuilder.limit).toHaveBeenCalledWith(5);
		});
	});

	describe('searchNote with meilisearch', () => {
		beforeEach(async () => {
			await setupModule({ index: jest.fn().mockReturnValue(meiliIndex) } as unknown as MeiliSearch, {
				meilisearch: { host: 'localhost', port: '7700', apiKey: '', index: 'test' },
			});
		});

		test('returns empty array when no hits', async () => {
			(meiliIndex.search as jest.Mock).mockResolvedValue({ hits: [] });

			const result = await searchService.searchNote('hello', null, {}, { limit: 10 });

			expect(result).toEqual([]);
			expect(notesRepository.createQueryBuilder).not.toHaveBeenCalled();
		});

		test('queries notes for each hit and returns visible ones', async () => {
			const note1 = createNote({ id: 'note1' });
			const note2 = createNote({ id: 'note2' });
			(meiliIndex.search as jest.Mock).mockResolvedValue({ hits: [{ id: 'note1' }, { id: 'note2' }] });

			const qb1 = createQueryBuilder();
			(qb1.getOne as jest.Mock).mockResolvedValue(note1);
			const qb2 = createQueryBuilder();
			(qb2.getOne as jest.Mock).mockResolvedValue(note2);
			(notesRepository.createQueryBuilder as jest.Mock)
				.mockReturnValueOnce(qb1)
				.mockReturnValueOnce(qb2);

			const result = await searchService.searchNote('hello', null, {}, { limit: 10 });

			expect(result).toEqual([note1, note2]);
			expect(meiliIndex.search).toHaveBeenCalledWith(
				'hello',
				expect.objectContaining({
					sort: ['createdAt:desc'],
					limit: 10,
				}),
			);
			expect(qb1.andWhere).toHaveBeenCalledWith('note.id = :id', { id: 'note1' });
			expect(qb2.andWhere).toHaveBeenCalledWith('note.id = :id', { id: 'note2' });
		});

		test('skips hits that are not visible to the requester', async () => {
			(meiliIndex.search as jest.Mock).mockResolvedValue({ hits: [{ id: 'note1' }, { id: 'note2' }] });

			const qb1 = createQueryBuilder();
			(qb1.getOne as jest.Mock).mockResolvedValue(null);
			const qb2 = createQueryBuilder();
			(qb2.getOne as jest.Mock).mockResolvedValue(createNote({ id: 'note2' }));
			(notesRepository.createQueryBuilder as jest.Mock)
				.mockReturnValueOnce(qb1)
				.mockReturnValueOnce(qb2);

			const result = await searchService.searchNote('hello', null, {}, { limit: 10 });

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('note2');
		});

		test('applies untilId and sinceId pagination via idService', async () => {
			(meiliIndex.search as jest.Mock).mockResolvedValue({ hits: [] });
			(idService.parse as jest.Mock)
				.mockReturnValueOnce({ date: new Date('2024-01-02T00:00:00.000Z') })
				.mockReturnValueOnce({ date: new Date('2024-01-03T00:00:00.000Z') });

			await searchService.searchNote('hello', null, {}, { untilId: 'until1', sinceId: 'since1', limit: 10 });

			expect(idService.parse).toHaveBeenCalledWith('until1');
			expect(idService.parse).toHaveBeenCalledWith('since1');
			expect(meiliIndex.search).toHaveBeenCalledWith(
				'hello',
				expect.objectContaining({
					filter: expect.stringContaining('createdAt < 1704153600000') as string,
				}),
			);
		});

		test('filters by userId and host', async () => {
			(meiliIndex.search as jest.Mock).mockResolvedValue({ hits: [] });

			await searchService.searchNote('hello', null, { userId: 'user2', host: 'example.com' }, { limit: 10 });

			expect(meiliIndex.search).toHaveBeenCalledWith(
				'hello',
				expect.objectContaining({
					filter: expect.stringMatching(/userId = 'user2'/) as string,
				}),
			);
			expect(meiliIndex.search).toHaveBeenCalledWith(
				'hello',
				expect.objectContaining({
					filter: expect.stringMatching(/userHost = 'example.com'/) as string,
				}),
			);
		});

		test('applies muted and blocked queries when me is provided', async () => {
			const me = createUser();
			(meiliIndex.search as jest.Mock).mockResolvedValue({ hits: [{ id: 'note1' }] });
			const qb1 = createQueryBuilder();
			(qb1.getOne as jest.Mock).mockResolvedValue(createNote({ id: 'note1' }));
			(notesRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb1);

			await searchService.searchNote('hello', me, {}, { limit: 10 });

			expect(queryService.generateMutedUserQuery).toHaveBeenCalledWith(qb1, me);
			expect(queryService.generateBlockedUserQuery).toHaveBeenCalledWith(qb1, me);
		});
	});
});
