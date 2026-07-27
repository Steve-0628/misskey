process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ApNoteService } from '@/core/activitypub/models/ApNoteService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { RemoteUser } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';
import type { Poll } from '@/models/entities/Poll.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import type { Emoji } from '@/models/entities/Emoji.js';
import type { PollsRepository, EmojisRepository } from '@/models/index.js';
import { MetaService } from '@/core/MetaService.js';
import { AppLockService } from '@/core/AppLockService.js';
import { PollService } from '@/core/PollService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { IdService } from '@/core/IdService.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { ApMfmService } from '@/core/activitypub/ApMfmService.js';
import { ApDbResolverService } from '@/core/activitypub/ApDbResolverService.js';
import { ApLoggerService } from '@/core/activitypub/ApLoggerService.js';
import { ApResolverService, Resolver } from '@/core/activitypub/ApResolverService.js';
import { ApAudienceService } from '@/core/activitypub/ApAudienceService.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { ApMentionService } from '@/core/activitypub/models/ApMentionService.js';
import { ApImageService } from '@/core/activitypub/models/ApImageService.js';
import { ApQuestionService } from '@/core/activitypub/models/ApQuestionService.js';
import type { TestingModule } from '@nestjs/testing';
import type { IObject, IPost } from '@/core/activitypub/type.js';

function createConfig(): Config {
	return {
		url: 'https://example.com',
		host: 'example.com',
		hostname: 'example.com',
		scheme: 'https',
		wsScheme: 'wss',
		apiUrl: 'https://example.com/api',
		wsUrl: 'wss://example.com/streaming',
		authUrl: 'https://example.com/auth',
		driveUrl: 'https://example.com/files',
		userAgent: 'Misskey/test',
		clientEntry: '',
		clientManifestExists: false,
		mediaProxy: 'https://example.com/proxy',
		externalMediaProxyEnabled: false,
		videoThumbnailGenerator: null,
		version: 'test',
		redis: { host: 'localhost', port: 6379, pass: '' },
		redisForPubsub: { host: 'localhost', port: 6379, pass: '' },
		redisForJobQueue: { host: 'localhost', port: 6379, pass: '' },
		db: { host: 'localhost', port: 5432, db: 'misskey', user: 'user', pass: 'pass' },
		id: 'test',
		signToActivityPubGet: false,
	};
}

function createRemoteUser(data: Partial<RemoteUser> = {}): RemoteUser {
	return {
		id: 'remoteuser1',
		createdAt: new Date('2024-01-01T00:00:00Z'),
		username: 'bob',
		usernameLower: 'bob',
		host: 'remote.example',
		uri: 'https://remote.example/users/bob',
		inbox: 'https://remote.example/users/bob/inbox',
		sharedInbox: 'https://remote.example/inbox',
		followersUri: 'https://remote.example/users/bob/followers',
		isSuspended: false,
		isLocked: false,
		isBot: false,
		isCat: false,
		isRoot: false,
		isExplorable: true,
		isDeleted: false,
		movedToUri: null,
		alsoKnownAs: null,
		followersCount: 0,
		followingCount: 0,
		notesCount: 0,
		avatarId: null,
		bannerId: null,
		avatarUrl: null,
		bannerUrl: null,
		avatarBlurhash: null,
		bannerBlurhash: null,
		emojis: [],
		tags: [],
		...data,
	} as RemoteUser;
}

function createNote(data: Partial<Note> = {}): Note {
	return {
		id: 'note1',
		createdAt: new Date('2024-01-01T00:00:00Z'),
		userId: 'remoteuser1',
		userHost: 'remote.example',
		text: 'hello world',
		cw: null,
		visibility: 'public',
		fileIds: [],
		mentions: [],
		mentionedRemoteUsers: '[]',
		emojis: [],
		tags: [],
		hasPoll: false,
		localOnly: false,
		renoteCount: 0,
		repliesCount: 0,
		reactions: {},
		score: 0,
		replyId: null,
		renoteId: null,
		uri: 'https://remote.example/notes/note1',
		url: null,
		...data,
	} as Note;
}

function createPostObject(data: Partial<IPost> = {}): IPost {
	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'Note',
		id: 'https://remote.example/notes/note1',
		attributedTo: 'https://remote.example/users/bob',
		content: '<p>hello world</p>',
		published: '2024-01-01T00:00:00Z',
		to: ['https://www.w3.org/ns/activitystreams#Public'],
		cc: ['https://remote.example/users/bob/followers'],
		...data,
	};
}

describe('ApNoteService', () => {
	let app: TestingModule;
	let service: ApNoteService;
	let config: Config;
	let pollsRepository: jest.Mocked<PollsRepository>;
	let emojisRepository: jest.Mocked<EmojisRepository>;
	let idService: jest.Mocked<IdService>;
	let metaService: jest.Mocked<MetaService>;
	let appLockService: jest.Mocked<AppLockService>;
	let pollService: jest.Mocked<PollService>;
	let noteCreateService: jest.Mocked<NoteCreateService>;
	let apMfmService: jest.Mocked<ApMfmService>;
	let apDbResolverService: jest.Mocked<ApDbResolverService>;
	let apResolverService: jest.Mocked<ApResolverService>;
	let apAudienceService: jest.Mocked<ApAudienceService>;
	let apPersonService: jest.Mocked<ApPersonService>;
	let apMentionService: jest.Mocked<ApMentionService>;
	let apImageService: jest.Mocked<ApImageService>;
	let apQuestionService: jest.Mocked<ApQuestionService>;
	let resolver: jest.Mocked<Resolver>;

	beforeEach(async () => {
		config = createConfig();

		pollsRepository = {
			findOneBy: jest.fn().mockResolvedValue(null),
			findOneByOrFail: jest.fn().mockResolvedValue(null),
			update: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<PollsRepository>;

		emojisRepository = {
			findBy: jest.fn().mockResolvedValue([]),
			findOneBy: jest.fn().mockResolvedValue(null),
			findOneByOrFail: jest.fn().mockResolvedValue(null),
			insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'emoji1' }] } as never),
			update: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<EmojisRepository>;

		idService = {
			genId: jest.fn().mockReturnValue('newid1'),
		} as unknown as jest.Mocked<IdService>;

		metaService = {
			fetch: jest.fn().mockResolvedValue({ blockedHosts: [] }),
		} as unknown as jest.Mocked<MetaService>;

		appLockService = {
			getApLock: jest.fn().mockResolvedValue(jest.fn()),
		} as unknown as jest.Mocked<AppLockService>;

		pollService = {
			vote: jest.fn().mockResolvedValue(undefined),
			deliverQuestionUpdate: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<PollService>;

		noteCreateService = {
			create: jest.fn().mockResolvedValue(createNote()),
		} as unknown as jest.Mocked<NoteCreateService>;

		apMfmService = {
			htmlToMfm: jest.fn().mockReturnValue('hello world'),
			getNoteHtml: jest.fn().mockReturnValue('<p>hello world</p>'),
		} as unknown as jest.Mocked<ApMfmService>;

		apDbResolverService = {
			getNoteFromApId: jest.fn().mockResolvedValue(null),
		} as unknown as jest.Mocked<ApDbResolverService>;

		resolver = {
			resolve: jest.fn().mockImplementation(async (value: string | IObject) => {
				if (typeof value === 'string') {
					return createPostObject({ id: value });
				}
				return value;
			}),
			getHistory: jest.fn().mockReturnValue([]),
		} as unknown as jest.Mocked<Resolver>;

		apResolverService = {
			createResolver: jest.fn().mockReturnValue(resolver),
		} as unknown as jest.Mocked<ApResolverService>;

		apAudienceService = {
			parseAudience: jest.fn().mockResolvedValue({
				visibility: 'public',
				mentionedUsers: [],
				visibleUsers: [],
			}),
		} as unknown as jest.Mocked<ApAudienceService>;

		apPersonService = {
			resolvePerson: jest.fn().mockResolvedValue(createRemoteUser()),
		} as unknown as jest.Mocked<ApPersonService>;

		apMentionService = {
			extractApMentions: jest.fn().mockResolvedValue([]),
		} as unknown as jest.Mocked<ApMentionService>;

		apImageService = {
			resolveImage: jest.fn().mockResolvedValue({ id: 'file1' } as DriveFile),
		} as unknown as jest.Mocked<ApImageService>;

		apQuestionService = {
			extractPollFromQuestion: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<ApQuestionService>;

		const apLoggerService = {
			logger: {
				info: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				succ: jest.fn(),
			},
		} as unknown as ApLoggerService;

		const utilityService = new UtilityService(config);

		app = await Test.createTestingModule({
			providers: [
				ApNoteService,
				{ provide: DI.config, useValue: config },
				{ provide: DI.pollsRepository, useValue: pollsRepository },
				{ provide: DI.emojisRepository, useValue: emojisRepository },
				{ provide: IdService, useValue: idService },
				{ provide: ApMfmService, useValue: apMfmService },
				{ provide: ApResolverService, useValue: apResolverService },
				{ provide: ApPersonService, useValue: apPersonService },
				{ provide: UtilityService, useValue: utilityService },
				{ provide: ApAudienceService, useValue: apAudienceService },
				{ provide: ApMentionService, useValue: apMentionService },
				{ provide: ApImageService, useValue: apImageService },
				{ provide: ApQuestionService, useValue: apQuestionService },
				{ provide: MetaService, useValue: metaService },
				{ provide: AppLockService, useValue: appLockService },
				{ provide: PollService, useValue: pollService },
				{ provide: NoteCreateService, useValue: noteCreateService },
				{ provide: ApDbResolverService, useValue: apDbResolverService },
				{ provide: ApLoggerService, useValue: apLoggerService },
			],
		}).compile();

		service = app.get<ApNoteService>(ApNoteService);
	});

	afterEach(async () => {
		await app.close();
	});

	describe('validateNote', () => {
		test('returns null for valid note', () => {
			const object = createPostObject();

			const result = service.validateNote(object, object.id);

			expect(result).toBeNull();
		});

		test('returns error for invalid type', () => {
			const object = createPostObject({ type: 'Like' as never });

			const result = service.validateNote(object, object.id);

			expect(result).toBeInstanceOf(Error);
			expect(result!.message).toContain('invalid object type');
		});

		test('returns error when id host differs', () => {
			const object = createPostObject({ id: 'https://other.example/notes/note1' });

			const result = service.validateNote(object, 'https://remote.example/notes/note1');

			expect(result).toBeInstanceOf(Error);
			expect(result!.message).toContain('id has different host');
		});

		test('returns error when attributedTo host differs', () => {
			const object = createPostObject({ attributedTo: 'https://other.example/users/bob' });

			const result = service.validateNote(object, object.id);

			expect(result).toBeInstanceOf(Error);
			expect(result!.message).toContain('attributedTo has different host');
		});
	});

	describe('fetchNote', () => {
		test('returns note from ap id', async () => {
			const note = createNote();
			apDbResolverService.getNoteFromApId.mockResolvedValue(note);

			const result = await service.fetchNote('https://remote.example/notes/note1');

			expect(result).toBe(note);
			expect(apDbResolverService.getNoteFromApId).toHaveBeenCalledWith('https://remote.example/notes/note1');
		});

		test('returns null when not found', async () => {
			apDbResolverService.getNoteFromApId.mockResolvedValue(null);

			const result = await service.fetchNote('https://remote.example/notes/note1');

			expect(result).toBeNull();
		});
	});

	describe('createNote', () => {
		test('creates a basic public note', async () => {
			const object = createPostObject();
			resolver.resolve.mockResolvedValue(object);

			const result = await service.createNote(object, resolver);

			expect(apPersonService.resolvePerson).toHaveBeenCalledWith('https://remote.example/users/bob', resolver);
			expect(noteCreateService.create).toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		test('throws for invalid note type', async () => {
			const object = createPostObject({ type: 'Like' as never });
			resolver.resolve.mockResolvedValue(object);

			await expect(service.createNote(object, resolver)).rejects.toThrow('invalid note');
		});

		test('throws when attributedTo is missing', async () => {
			const object = createPostObject({ attributedTo: undefined });
			resolver.resolve.mockResolvedValue(object);

			await expect(service.createNote(object, resolver)).rejects.toThrow('invalid note.attributedTo');
		});

		test('throws when actor is suspended', async () => {
			apPersonService.resolvePerson.mockResolvedValue(createRemoteUser({ isSuspended: true }));

			await expect(service.createNote(createPostObject(), resolver)).rejects.toThrow('actor has been suspended');
		});

		test('creates a note from a string uri', async () => {
			const object = createPostObject();
			resolver.resolve.mockResolvedValue(object);

			const result = await service.createNote('https://remote.example/notes/note1', resolver);

			expect(resolver.resolve).toHaveBeenCalledWith('https://remote.example/notes/note1');
			expect(result).toBeDefined();
		});

		test('creates a note with attachments', async () => {
			const object = createPostObject({
				attachment: [{
					type: 'Document',
					url: 'https://remote.example/files/image.png',
					mediaType: 'image/png',
					name: 'image.png',
				}],
			});
			resolver.resolve.mockResolvedValue(object);

			await service.createNote(object, resolver);

			expect(apImageService.resolveImage).toHaveBeenCalledTimes(1);
			expect(noteCreateService.create).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ files: [expect.objectContaining({ id: 'file1' })] }),
				expect.anything(),
			);
		});

		test('creates a note with reply', async () => {
			const reply = createNote({ id: 'reply1', uri: 'https://remote.example/notes/reply1' });
			const object = createPostObject({ inReplyTo: 'https://remote.example/notes/reply1' });
			resolver.resolve.mockImplementation(async (value) => {
				if (value === 'https://remote.example/notes/reply1') return reply;
				return typeof value === 'string' ? createPostObject({ id: value }) : value;
			});
			apDbResolverService.getNoteFromApId.mockImplementation(async (value) => {
				if (typeof value === 'string' && value === 'https://remote.example/notes/reply1') return reply;
				return null;
			});

			await service.createNote(object, resolver);

			expect(noteCreateService.create).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ reply }),
				expect.anything(),
			);
		});

		test('creates a note with quote', async () => {
			const quote = createNote({ id: 'quote1', uri: 'https://remote.example/notes/quote1' });
			const object = createPostObject({ quoteUrl: 'https://remote.example/notes/quote1' });
			resolver.resolve.mockImplementation(async (value) => {
				if (value === 'https://remote.example/notes/quote1') return quote;
				return typeof value === 'string' ? createPostObject({ id: value }) : value;
			});
			apDbResolverService.getNoteFromApId.mockImplementation(async (value) => {
				if (typeof value === 'string' && value === 'https://remote.example/notes/quote1') return quote;
				return null;
			});

			await service.createNote(object, resolver);

			expect(noteCreateService.create).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ renote: quote }),
				expect.anything(),
			);
		});

		test('uses source content for Misskey markdown', async () => {
			const object = createPostObject({
				source: {
					content: 'source text',
					mediaType: 'text/x.misskeymarkdown',
				},
			});
			resolver.resolve.mockResolvedValue(object);

			await service.createNote(object, resolver);

			expect(noteCreateService.create).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ text: 'source text' }),
				expect.anything(),
			);
		});

		test('uses _misskey_content when present', async () => {
			const object = createPostObject({ _misskey_content: 'misskey content' });
			resolver.resolve.mockResolvedValue(object);

			await service.createNote(object, resolver);

			expect(noteCreateService.create).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ text: 'misskey content' }),
				expect.anything(),
			);
		});

		test('falls back to htmlToMfm for content', async () => {
			const object = createPostObject({ content: '<p>html content</p>' });
			resolver.resolve.mockResolvedValue(object);

			await service.createNote(object, resolver);

			expect(apMfmService.htmlToMfm).toHaveBeenCalledWith('<p>html content</p>', undefined);
		});

		test('creates a vote when note is a poll reply', async () => {
			const reply = createNote({ id: 'reply1', hasPoll: true, uri: 'https://remote.example/notes/reply1' });
			const poll: Poll = {
				noteId: 'reply1',
				choices: ['a', 'b'],
				votes: [0, 0],
				multiple: false,
				expiresAt: new Date('2099-01-01T00:00:00Z'),
				noteVisibility: 'public',
				userId: 'remoteuser1',
				userHost: 'remote.example',
			};
			pollsRepository.findOneByOrFail.mockResolvedValue(poll);

			const object = createPostObject({
				inReplyTo: 'https://remote.example/notes/reply1',
				name: 'b',
			});
			resolver.resolve.mockImplementation(async (value) => {
				if (value === 'https://remote.example/notes/reply1') return reply;
				return typeof value === 'string' ? createPostObject({ id: value }) : value;
			});
			apDbResolverService.getNoteFromApId.mockImplementation(async (value) => {
				if (typeof value === 'string' && value === 'https://remote.example/notes/reply1') return reply;
				return null;
			});

			await service.createNote(object, resolver);

			expect(pollService.vote).toHaveBeenCalledWith(expect.anything(), reply, 1);
			expect(pollService.deliverQuestionUpdate).toHaveBeenCalledWith('reply1');
		});

		test('handles mentions and hashtags', async () => {
			const object = createPostObject({
				tag: [
					{ type: 'Mention', href: 'https://remote.example/users/alice', name: '@alice@remote.example' },
					{ type: 'Hashtag', name: '#test' },
				],
			});
			resolver.resolve.mockResolvedValue(object);
			apMentionService.extractApMentions.mockResolvedValue([]);

			await service.createNote(object, resolver);

			expect(apMentionService.extractApMentions).toHaveBeenCalledWith(object.tag, resolver);
			expect(noteCreateService.create).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ apHashtags: ['test'] }),
				expect.anything(),
			);
		});

		test('extracts custom emojis from tags', async () => {
			const emoji: Emoji = {
				id: 'emoji1',
				name: 'cat',
				host: 'remote.example',
				publicUrl: 'https://remote.example/emojis/cat.png',
				originalUrl: 'https://remote.example/emojis/cat.png',
				type: 'image/png',
				updatedAt: new Date('2024-01-01T00:00:00Z'),
				aliases: [],
				category: null,
				isSensitive: false,
				localOnly: false,
				license: null,
				roleIdsThatCanBeUsedThisEmojiAsReaction: [],
				uri: 'https://remote.example/emojis/cat',
			};
			emojisRepository.findBy.mockResolvedValue([emoji]);

			const object = createPostObject({
				tag: [{
					type: 'Emoji',
					name: ':cat:',
					icon: {
						type: 'Image',
						url: 'https://remote.example/emojis/cat.png',
					},
					updated: '2024-01-01T00:00:00Z',
				}],
			});
			resolver.resolve.mockResolvedValue(object);

			await service.createNote(object, resolver);

			expect(noteCreateService.create).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ apEmojis: ['cat'] }),
				expect.anything(),
			);
		});
	});

	describe('resolveNote', () => {
		test('returns existing local note without fetching', async () => {
			const note = createNote();
			apDbResolverService.getNoteFromApId.mockResolvedValue(note);

			const result = await service.resolveNote('https://remote.example/notes/note1');

			expect(result).toBe(note);
			expect(resolver.resolve).not.toHaveBeenCalled();
		});

		test('throws for blocked host', async () => {
			metaService.fetch.mockResolvedValue({ blockedHosts: ['remote.example'] });

			await expect(service.resolveNote('https://remote.example/notes/note1')).rejects.toThrow('blocked host');
		});

		test('throws for local note uri', async () => {
			await expect(service.resolveNote(`${config.url}/notes/note1`)).rejects.toThrow('cannot resolve local note');
		});

		test('creates note from remote uri when not cached', async () => {
			apDbResolverService.getNoteFromApId.mockResolvedValue(null);
			const object = createPostObject();
			resolver.resolve.mockResolvedValue(object);

			const result = await service.resolveNote('https://remote.example/notes/note1');

			expect(noteCreateService.create).toHaveBeenCalled();
			expect(result).toBeDefined();
		});
	});

	describe('extractEmojis', () => {
		test('returns empty array when no emoji tags', async () => {
			const result = await service.extractEmojis([], 'remote.example');

			expect(result).toEqual([]);
		});

		test('creates new emoji when not existing', async () => {
			const insertedEmoji: Emoji = {
				id: 'emoji1',
				name: 'cat',
				host: 'remote.example',
				publicUrl: 'https://remote.example/emojis/cat.png',
				originalUrl: 'https://remote.example/emojis/cat.png',
				type: 'image/png',
				updatedAt: new Date('2024-01-01T00:00:00Z'),
				aliases: [],
				category: null,
				isSensitive: false,
				localOnly: false,
				license: null,
				roleIdsThatCanBeUsedThisEmojiAsReaction: [],
				uri: 'https://remote.example/emojis/cat',
			};
			emojisRepository.insert.mockResolvedValue({ identifiers: [{ id: insertedEmoji.id }] } as never);
			emojisRepository.findOneByOrFail.mockResolvedValue(insertedEmoji);

			const result = await service.extractEmojis([{
				type: 'Emoji',
				name: ':cat:',
				icon: {
					type: 'Image',
					url: 'https://remote.example/emojis/cat.png',
				},
				updated: '2024-01-01T00:00:00Z',
			}], 'remote.example');

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('cat');
			expect(emojisRepository.insert).toHaveBeenCalled();
		});

		test('updates existing emoji when icon url changed', async () => {
			const existing: Emoji = {
				id: 'emoji1',
				name: 'cat',
				host: 'remote.example',
				publicUrl: 'https://remote.example/emojis/old.png',
				originalUrl: 'https://remote.example/emojis/old.png',
				type: 'image/png',
				updatedAt: new Date('2024-01-01T00:00:00Z'),
				aliases: [],
				category: null,
				isSensitive: false,
				localOnly: false,
				license: null,
				roleIdsThatCanBeUsedThisEmojiAsReaction: [],
				uri: null,
			};
			emojisRepository.findBy.mockResolvedValue([existing]);

			emojisRepository.findOneBy.mockResolvedValue(existing);

			const result = await service.extractEmojis([{
				type: 'Emoji',
				name: ':cat:',
				icon: {
					type: 'Image',
					url: 'https://remote.example/emojis/cat.png',
				},
				updated: '2024-01-01T00:00:00Z',
			}], 'remote.example');

			expect(emojisRepository.update).toHaveBeenCalled();
			expect(result).toHaveLength(1);
		});
	});
});
