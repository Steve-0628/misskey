process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { WellKnownServerService } from '@/server/WellKnownServerService.js';
import { NodeinfoServerService } from '@/server/NodeinfoServerService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { User } from '@/models/entities/User.js';
import type { UsersRepository } from '@/models/index.js';

function createConfig(partial: Partial<Config> = {}): Config {
	return {
		url: 'https://example.com',
		host: 'example.com',
		hostname: 'example.com',
		scheme: 'https',
		wsScheme: 'wss',
		version: '13.0.0',
		apiUrl: 'https://example.com/api',
		wsUrl: 'wss://example.com/streaming',
		authUrl: 'https://example.com/auth',
		driveUrl: 'https://example.com/files',
		userAgent: 'MisskeyTest/13.0.0',
		clientEntry: '/client',
		clientManifestExists: false,
		mediaProxy: 'https://example.com/proxy',
		externalMediaProxyEnabled: false,
		videoThumbnailGenerator: null,
		redis: { host: 'localhost', port: 6379, pass: '' } as unknown as Config['redis'],
		redisForPubsub: { host: 'localhost', port: 6379, pass: '' } as unknown as Config['redisForPubsub'],
		redisForJobQueue: { host: 'localhost', port: 6379, pass: '' } as unknown as Config['redisForJobQueue'],
		db: { host: 'localhost', port: 5432, db: 'misskey', user: 'misskey', pass: 'misskey' },
		id: 'test',
		...partial,
	} as unknown as Config;
}

function createUser(partial: Partial<User> = {}): User {
	return {
		id: 'user1',
		createdAt: new Date(),
		updatedAt: null,
		lastFetchedAt: null,
		lastActiveDate: null,
		hideOnlineStatus: false,
		username: 'alice',
		usernameLower: 'alice',
		name: null,
		followersCount: 0,
		followingCount: 0,
		movedToUri: null,
		movedAt: null,
		alsoKnownAs: null,
		notesCount: 0,
		avatarId: null,
		avatar: null,
		bannerId: null,
		banner: null,
		avatarUrl: null,
		bannerUrl: null,
		avatarBlurhash: null,
		bannerBlurhash: null,
		tags: [],
		isSuspended: false,
		isLocked: false,
		isBot: false,
		isCat: false,
		isRoot: false,
		isExplorable: true,
		isDeleted: false,
		emojis: [],
		host: null,
		inbox: null,
		sharedInbox: null,
		featured: null,
		uri: null,
		followersUri: null,
		token: null,
		...partial,
	} as unknown as User;
}

describe('WellKnownServerService', () => {
	let fastify: FastifyInstance;
	let usersRepository: jest.Mocked<UsersRepository>;
	let userEntityService: jest.Mocked<UserEntityService>;
	let nodeinfoServerService: jest.Mocked<NodeinfoServerService>;
	let wellKnownServerService: WellKnownServerService;
	let config: Config;

	beforeEach(async () => {
		config = createConfig();
		usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		userEntityService = {
			genLocalUserUri: jest.fn().mockReturnValue('https://example.com/users/user1'),
		} as unknown as jest.Mocked<UserEntityService>;

		nodeinfoServerService = {
			getLinks: jest.fn().mockReturnValue([{
				rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
				href: 'https://example.com/nodeinfo/2.0',
			}]),
		} as unknown as jest.Mocked<NodeinfoServerService>;

		wellKnownServerService = new WellKnownServerService(
			config,
			usersRepository,
			nodeinfoServerService,
			userEntityService,
		);

		fastify = Fastify();
		fastify.register(wellKnownServerService.createServer);
		await fastify.ready();
	});

	afterEach(async () => {
		await fastify.close();
	});

	describe('CORS preflight', () => {
		test('responds 204 to OPTIONS on well-known paths', async () => {
			const response = await fastify.inject({
				method: 'OPTIONS',
				url: '/.well-known/webfinger',
			});

			expect(response.statusCode).toBe(204);
			expect(response.headers['access-control-allow-origin']).toBe('*');
			expect(response.headers['access-control-allow-methods']).toBe('GET, OPTIONS');
		});
	});

	describe('GET /.well-known/host-meta', () => {
		test('returns XRD with lrdd template', async () => {
			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/host-meta',
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers['content-type']).toContain('application/xrd+xml');
			expect(response.payload).toContain('<Link rel="lrdd" type="application/xrd+xml" template="https://example.com/.well-known/webfinger?resource={uri}"');
		});
	});

	describe('GET /.well-known/host-meta.json', () => {
		test('returns JRD with lrdd template', async () => {
			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/host-meta.json',
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers['content-type']).toContain('application/jrd+json');

			const body = response.json();
			expect(body.links).toEqual([{
				rel: 'lrdd',
				type: 'application/jrd+json',
				template: 'https://example.com/.well-known/webfinger?resource={uri}',
			}]);
		});
	});

	describe('GET /.well-known/nodeinfo', () => {
		test('returns nodeinfo links', async () => {
			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/nodeinfo',
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({
				links: [{
					rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
					href: 'https://example.com/nodeinfo/2.0',
				}],
			});
			expect(nodeinfoServerService.getLinks).toHaveBeenCalled();
		});
	});

	describe('GET /.well-known/webfinger', () => {
		test('returns 400 when resource is missing', async () => {
			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/webfinger',
			});

			expect(response.statusCode).toBe(400);
		});

		test('returns 404 when user is not found', async () => {
			usersRepository.findOneBy.mockResolvedValue(null);

			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/webfinger?resource=acct:alice@example.com',
			});

			expect(response.statusCode).toBe(404);
		});

		test('returns 422 for foreign host', async () => {
			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/webfinger?resource=acct:alice@other.example',
			});

			expect(response.statusCode).toBe(422);
		});

		test('looks up by acct URI and returns JRD by default', async () => {
			usersRepository.findOneBy.mockResolvedValue(createUser({ username: 'alice', usernameLower: 'alice' }));

			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/webfinger?resource=acct:alice@example.com',
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers['cache-control']).toBe('public, max-age=180');
			expect(response.headers['content-type']).toContain('application/jrd+json');

			const body = response.json();
			expect(body.subject).toBe('acct:alice@example.com');
			expect(body.links).toContainEqual({
				rel: 'self',
				type: 'application/activity+json',
				href: 'https://example.com/users/user1',
			});
			expect(body.links).toContainEqual({
				rel: 'http://webfinger.net/rel/profile-page',
				type: 'text/html',
				href: 'https://example.com/@alice',
			});
			expect(body.links).toContainEqual({
				rel: 'http://ostatus.org/schema/1.0/subscribe',
				template: 'https://example.com/authorize-follow?acct={uri}',
			});
			expect(usersRepository.findOneBy).toHaveBeenCalledWith(expect.objectContaining({
				usernameLower: 'alice',
				host: expect.anything(),
				isSuspended: false,
			}));
		});

		test('looks up by user URL', async () => {
			usersRepository.findOneBy.mockResolvedValue(createUser({ id: 'user1' }));

			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/webfinger?resource=https://example.com/users/user1',
			});

			expect(response.statusCode).toBe(200);
			expect(usersRepository.findOneBy).toHaveBeenCalledWith(expect.objectContaining({
				id: 'user1',
				host: expect.anything(),
				isSuspended: false,
			}));
		});

		test('looks up by profile URL', async () => {
			usersRepository.findOneBy.mockResolvedValue(createUser({ username: 'alice', usernameLower: 'alice' }));

			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/webfinger?resource=https://example.com/@alice',
			});

			expect(response.statusCode).toBe(200);
			expect(usersRepository.findOneBy).toHaveBeenCalledWith(expect.objectContaining({
				usernameLower: 'alice',
				host: expect.anything(),
				isSuspended: false,
			}));
		});

		test('returns XRD when Accept prefers application/xrd+xml', async () => {
			usersRepository.findOneBy.mockResolvedValue(createUser({ username: 'alice', usernameLower: 'alice' }));

			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/webfinger?resource=acct:alice@example.com',
				headers: { Accept: 'application/xrd+xml' },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers['content-type']).toContain('application/xrd+xml');
			expect(response.payload).toContain('<Subject>acct:alice@example.com</Subject>');
			expect(response.payload).toContain('rel="self"');
			expect(response.payload).toContain('href="https://example.com/users/user1"');
		});

		test('is case-insensitive for resource', async () => {
			usersRepository.findOneBy.mockResolvedValue(createUser({ username: 'Alice', usernameLower: 'alice' }));

			const response = await fastify.inject({
				method: 'GET',
				url: '/.well-known/webfinger?resource=ACCT:ALICE@EXAMPLE.COM',
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().subject).toBe('acct:Alice@example.com');
		});
	});
});
