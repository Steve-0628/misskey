process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ApResolverService, Resolver } from '@/core/activitypub/ApResolverService.js';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, NotesRepository, PollsRepository, NoteReactionsRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';
import type { Poll } from '@/models/entities/Poll.js';
import type { NoteReaction } from '@/models/entities/NoteReaction.js';
import { UtilityService } from '@/core/UtilityService.js';
import { InstanceActorService } from '@/core/InstanceActorService.js';
import { MetaService } from '@/core/MetaService.js';
import { ApRequestService } from '@/core/activitypub/ApRequestService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { ApDbResolverService } from '@/core/activitypub/ApDbResolverService.js';
import { LoggerService } from '@/core/LoggerService.js';
import type { TestingModule } from '@nestjs/testing';
import type { IObject, ICollection } from '@/core/activitypub/type.js';

function createMockLogger() {
	return {
		info: jest.fn(),
		succ: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
	};
}

function createConfig(overrides: Partial<Config> = {}): Config {
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
		...overrides,
	} as Config;
}

function createRemoteObject(): IObject {
	return {
		type: 'Note',
		id: 'https://remote.example/objects/1',
		'@context': 'https://www.w3.org/ns/activitystreams',
	};
}

describe('ApResolverService', () => {
	let app: TestingModule;
	let service: ApResolverService;
	let config: Config;
	let usersRepository: jest.Mocked<UsersRepository>;
	let notesRepository: jest.Mocked<NotesRepository>;
	let pollsRepository: jest.Mocked<PollsRepository>;
	let noteReactionsRepository: jest.Mocked<NoteReactionsRepository>;
	let utilityService: UtilityService;
	let instanceActorService: jest.Mocked<InstanceActorService>;
	let metaService: jest.Mocked<MetaService>;
	let apRequestService: jest.Mocked<ApRequestService>;
	let httpRequestService: jest.Mocked<HttpRequestService>;
	let apRendererService: jest.Mocked<ApRendererService>;
	let apDbResolverService: jest.Mocked<ApDbResolverService>;
	let loggerService: jest.Mocked<LoggerService>;

	beforeEach(async () => {
		config = createConfig();

		usersRepository = {
			findOneByOrFail: jest.fn().mockImplementation(async (where: { id: string }) => {
				if (where.id === 'user1') return { id: 'user1' } as LocalUser;
				if (where.id === 'user2') return { id: 'user2' } as RemoteUser;
				throw new Error('user not found');
			}),
		} as unknown as jest.Mocked<UsersRepository>;

		notesRepository = {
			findOneByOrFail: jest.fn().mockImplementation(async (where: { id: string }) => {
				if (where.id === 'note1') return { id: 'note1', userId: 'user1' } as Note;
				throw new Error('note not found');
			}),
		} as unknown as jest.Mocked<NotesRepository>;

		pollsRepository = {
			findOneByOrFail: jest.fn().mockResolvedValue({ noteId: 'note1', choices: ['a'] } as Poll),
		} as unknown as jest.Mocked<PollsRepository>;

		noteReactionsRepository = {
			findOneByOrFail: jest.fn().mockResolvedValue({ id: 'reaction1' } as NoteReaction),
		} as unknown as jest.Mocked<NoteReactionsRepository>;

		utilityService = new UtilityService(config);

		instanceActorService = {
			getInstanceActor: jest.fn().mockResolvedValue({ id: 'instanceactor1' } as LocalUser),
		} as unknown as jest.Mocked<InstanceActorService>;

		metaService = {
			fetch: jest.fn().mockResolvedValue({ blockedHosts: [] }),
		} as unknown as jest.Mocked<MetaService>;

		apRequestService = {
			signedPost: jest.fn().mockResolvedValue(undefined),
			signedGet: jest.fn().mockResolvedValue(createRemoteObject()),
		} as unknown as jest.Mocked<ApRequestService>;

		httpRequestService = {
			getJson: jest.fn().mockResolvedValue(createRemoteObject()),
			send: jest.fn().mockResolvedValue({ ok: true } as Response),
		} as unknown as jest.Mocked<HttpRequestService>;

		apRendererService = {
			renderNote: jest.fn().mockReturnValue({ type: 'Note', id: 'https://example.com/notes/note1' }),
			renderPerson: jest.fn().mockReturnValue({ type: 'Person', id: 'https://example.com/users/user1' }),
			renderQuestion: jest.fn().mockReturnValue({ type: 'Question', id: 'https://example.com/questions/note1' }),
			renderLike: jest.fn().mockResolvedValue({ type: 'Like', id: 'https://example.com/likes/reaction1' }),
			renderFollow: jest.fn().mockReturnValue({ type: 'Follow', id: 'https://example.com/follows/user1/user2' }),
			renderCreate: jest.fn().mockReturnValue({ type: 'Create' }),
			addContext: jest.fn().mockImplementation((x: IObject) => x),
		} as unknown as jest.Mocked<ApRendererService>;

		apDbResolverService = {
			parseUri: jest.fn().mockImplementation((value: string | IObject) => {
				const url = new URL(typeof value === 'string' ? value : (value.id ?? 'https://example.com/'));
				if (url.origin !== config.url) {
					return { local: false, uri: url.href };
				}
				const [, type, id, ...rest] = url.pathname.split('/');
				return {
					local: true,
					type,
					id,
					rest: rest.length === 0 ? undefined : rest.join('/'),
				};
			}),
		} as unknown as jest.Mocked<ApDbResolverService>;

		loggerService = {
			getLogger: jest.fn().mockReturnValue(createMockLogger()),
		} as unknown as jest.Mocked<LoggerService>;

		app = await Test.createTestingModule({
			providers: [
				ApResolverService,
				{ provide: DI.config, useValue: config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.notesRepository, useValue: notesRepository },
				{ provide: DI.pollsRepository, useValue: pollsRepository },
				{ provide: DI.noteReactionsRepository, useValue: noteReactionsRepository },
				{ provide: UtilityService, useValue: utilityService },
				{ provide: InstanceActorService, useValue: instanceActorService },
				{ provide: MetaService, useValue: metaService },
				{ provide: ApRequestService, useValue: apRequestService },
				{ provide: HttpRequestService, useValue: httpRequestService },
				{ provide: ApRendererService, useValue: apRendererService },
				{ provide: ApDbResolverService, useValue: apDbResolverService },
				{ provide: LoggerService, useValue: loggerService },
			],
		}).compile();

		service = app.get<ApResolverService>(ApResolverService);
	});

	afterEach(async () => {
		await app.close();
	});

	describe('createResolver', () => {
		test('creates a resolver', () => {
			const resolver = service.createResolver();
			expect(resolver).toBeInstanceOf(Resolver);
			expect(resolver.getHistory()).toEqual([]);
		});
	});

	describe('Resolver.resolve', () => {
		test('returns non-string value as-is', async () => {
			const resolver = service.createResolver();
			const object = createRemoteObject();
			const result = await resolver.resolve(object);
			expect(result).toBe(object);
			expect(httpRequestService.getJson).not.toHaveBeenCalled();
		});

		test('throws for URL with fragment', async () => {
			const resolver = service.createResolver();
			await expect(resolver.resolve('https://remote.example/objects/1#fragment')).rejects.toThrow('cannot resolve URL with fragment');
		});

		test('throws when resolving the same URL twice', async () => {
			const resolver = service.createResolver();
			const url = 'https://remote.example/objects/1';
			await resolver.resolve(url);
			await expect(resolver.resolve(url)).rejects.toThrow('cannot resolve already resolved one');
		});

		test('throws when recursion limit is exceeded', async () => {
			const resolver = new Resolver(
				config,
				usersRepository,
				notesRepository,
				pollsRepository,
				noteReactionsRepository,
				utilityService,
				instanceActorService,
				metaService,
				apRequestService,
				httpRequestService,
				apRendererService,
				apDbResolverService,
				loggerService,
				2,
			);

			await resolver.resolve('https://remote.example/objects/1');
			await resolver.resolve('https://remote.example/objects/2');
			await resolver.resolve('https://remote.example/objects/3');
			await expect(resolver.resolve('https://remote.example/objects/4')).rejects.toThrow('hit recursion limit');
		});

		test('throws for blocked host', async () => {
			metaService.fetch.mockResolvedValue({ blockedHosts: ['remote.example'] });
			const resolver = service.createResolver();

			await expect(resolver.resolve('https://remote.example/objects/1')).rejects.toThrow('Instance is blocked');
			expect(httpRequestService.getJson).not.toHaveBeenCalled();
			expect(apRequestService.signedGet).not.toHaveBeenCalled();
		});

		test('fetches remote object via HTTP GET when signToActivityPubGet is false', async () => {
			config = createConfig({ signToActivityPubGet: false });
			const resolver = service.createResolver();
			const url = 'https://remote.example/objects/1';

			const result = await resolver.resolve(url);

			expect(httpRequestService.getJson).toHaveBeenCalledTimes(1);
			expect(httpRequestService.getJson).toHaveBeenCalledWith(url, 'application/activity+json, application/ld+json');
			expect(apRequestService.signedGet).not.toHaveBeenCalled();
			expect(instanceActorService.getInstanceActor).not.toHaveBeenCalled();
			expect(result).toEqual(createRemoteObject());
		});

		test('fetches remote object via signed GET when signToActivityPubGet is true', async () => {
			config.signToActivityPubGet = true;
			const resolver = service.createResolver();
			const url = 'https://remote.example/objects/1';

			const result = await resolver.resolve(url);

			expect(instanceActorService.getInstanceActor).toHaveBeenCalled();
			expect(apRequestService.signedGet).toHaveBeenCalledTimes(1);
			expect(apRequestService.signedGet).toHaveBeenCalledWith(url, { id: 'instanceactor1' });
			expect(httpRequestService.getJson).not.toHaveBeenCalled();
			expect(result).toEqual(createRemoteObject());
		});

		test('throws when response has invalid @context string', async () => {
			httpRequestService.getJson.mockResolvedValue({ type: 'Note', '@context': 'https://bad.example/context' });
			const resolver = service.createResolver();

			await expect(resolver.resolve('https://remote.example/objects/1')).rejects.toThrow('invalid response');
		});

		test('throws when response has invalid @context array', async () => {
			httpRequestService.getJson.mockResolvedValue({ type: 'Note', '@context': ['https://bad.example/context'] });
			const resolver = service.createResolver();

			await expect(resolver.resolve('https://remote.example/objects/1')).rejects.toThrow('invalid response');
		});

		test('accepts response with @context array containing ActivityStreams context', async () => {
			const object = {
				type: 'Note',
				id: 'https://remote.example/objects/1',
				'@context': ['https://www.w3.org/ns/activitystreams'],
			};
			httpRequestService.getJson.mockResolvedValue(object);
			const resolver = service.createResolver();

			const result = await resolver.resolve('https://remote.example/objects/1');
			expect(result).toEqual(object);
		});

		describe('local resolution', () => {
			test('resolves a local note', async () => {
				const resolver = service.createResolver();
				const result = await resolver.resolve('https://example.com/notes/note1');

				expect(notesRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'note1' });
				expect(apRendererService.renderNote).toHaveBeenCalled();
				expect(result).toEqual(apRendererService.renderNote.mock.results[0].value);
			});

			test('resolves a local note activity', async () => {
				const resolver = service.createResolver();
				const result = await resolver.resolve('https://example.com/notes/note1/activity');

				expect(notesRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'note1' });
				expect(apRendererService.renderNote).toHaveBeenCalled();
				expect(apRendererService.renderCreate).toHaveBeenCalled();
				expect(apRendererService.addContext).toHaveBeenCalled();
				expect(result).toEqual({ type: 'Create' });
			});

			test('resolves a local user', async () => {
				const resolver = service.createResolver();
				const result = await resolver.resolve('https://example.com/users/user1');

				expect(usersRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'user1' });
				expect(apRendererService.renderPerson).toHaveBeenCalled();
				expect(result).toEqual(apRendererService.renderPerson.mock.results[0].value);
			});

			test('resolves a local question', async () => {
				const resolver = service.createResolver();
				const result = await resolver.resolve('https://example.com/questions/note1');

				expect(notesRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'note1' });
				expect(pollsRepository.findOneByOrFail).toHaveBeenCalledWith({ noteId: 'note1' });
				expect(apRendererService.renderQuestion).toHaveBeenCalled();
				expect(result).toEqual(apRendererService.renderQuestion.mock.results[0].value);
			});

			test('resolves a local like', async () => {
				const resolver = service.createResolver();
				const result = await resolver.resolve('https://example.com/likes/reaction1');

				expect(noteReactionsRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'reaction1' });
				expect(apRendererService.renderLike).toHaveBeenCalled();
				expect(apRendererService.addContext).toHaveBeenCalled();
				expect(result).toEqual({ type: 'Like', id: 'https://example.com/likes/reaction1' });
			});

			test('resolves a local follow', async () => {
				const resolver = service.createResolver();
				const result = await resolver.resolve('https://example.com/follows/user1/user2');

				expect(usersRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'user1' });
				expect(usersRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 'user2' });
				expect(apRendererService.renderFollow).toHaveBeenCalled();
				expect(apRendererService.addContext).toHaveBeenCalled();
				expect(result).toEqual({ type: 'Follow', id: 'https://example.com/follows/user1/user2' });
			});

			test('throws for unrecognized local type', async () => {
				const resolver = service.createResolver();
				await expect(resolver.resolve('https://example.com/unknown/foo')).rejects.toThrow('resolveLocal: type unknown unhandled');
			});
		});
	});

	describe('Resolver.resolveCollection', () => {
		test('returns collection object as-is', async () => {
			const resolver = service.createResolver();
			const collection = { type: 'Collection', id: 'https://remote.example/collection/1' } as ICollection;

			const result = await resolver.resolveCollection(collection);

			expect(result).toBe(collection);
			expect(httpRequestService.getJson).not.toHaveBeenCalled();
		});

		test('fetches and validates a collection URL', async () => {
			const collection = { type: 'Collection', id: 'https://remote.example/collection/1', '@context': 'https://www.w3.org/ns/activitystreams' };
			httpRequestService.getJson.mockResolvedValue(collection);
			const resolver = service.createResolver();

			const result = await resolver.resolveCollection('https://remote.example/collection/1');

			expect(httpRequestService.getJson).toHaveBeenCalledWith('https://remote.example/collection/1', 'application/activity+json, application/ld+json');
			expect(result).toEqual(collection);
		});

		test('throws for non-collection object', async () => {
			httpRequestService.getJson.mockResolvedValue({ type: 'Note', '@context': 'https://www.w3.org/ns/activitystreams' });
			const resolver = service.createResolver();

			await expect(resolver.resolveCollection('https://remote.example/objects/1')).rejects.toThrow('unrecognized collection type');
		});
	});
});
