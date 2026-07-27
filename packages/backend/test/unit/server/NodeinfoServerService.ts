process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Test } from '@nestjs/testing';
import Fastify from 'fastify';
import type { TestingModule } from '@nestjs/testing';
import type { FastifyInstance } from 'fastify';
import { NodeinfoServerService } from '@/server/NodeinfoServerService.js';
import { MetaService } from '@/core/MetaService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import NotesChart from '@/core/chart/charts/notes.js';
import UsersChart from '@/core/chart/charts/users.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { Meta } from '@/models/entities/Meta.js';
import type { Packed } from '@/misc/json-schema.js';
import type { UsersRepository, NotesRepository } from '@/models/index.js';

function createMeta(partial: Partial<Meta> = {}): Meta {
	return {
		id: 'x',
		name: 'Test Instance',
		description: 'A test instance',
		maintainerName: 'Admin',
		maintainerEmail: 'admin@example.com',
		disableRegistration: false,
		emailRequiredForSignup: false,
		enableHcaptcha: false,
		hcaptchaSiteKey: null,
		enableRecaptcha: false,
		recaptchaSiteKey: null,
		enableTurnstile: false,
		turnstileSiteKey: null,
		langs: ['ja', 'en'],
		pinnedUsers: [],
		hiddenTags: [],
		blockedHosts: [],
		sensitiveWords: [],
		preservedUsernames: [],
		themeColor: null,
		mascotImageUrl: '/assets/ai.png',
		bannerUrl: null,
		backgroundImageUrl: null,
		logoImageUrl: null,
		iconUrl: null,
		serverErrorImageUrl: null,
		notFoundImageUrl: null,
		infoImageUrl: null,
		defaultLightTheme: null,
		defaultDarkTheme: null,
		proxyAccountId: null,
		proxyAccount: null,
		termsOfServiceUrl: null,
		repositoryUrl: 'https://github.com/misskey-dev/misskey',
		feedbackUrl: 'https://github.com/misskey-dev/misskey/issues/new',
		email: null,
		enableEmail: false,
		smtpSecure: false,
		smtpHost: null,
		smtpPort: null,
		smtpUser: null,
		smtpPass: null,
		swPublicKey: null,
		swPrivateKey: null,
		deeplAuthKey: null,
		deeplIsPro: false,
		summalyProxy: null,
		useObjectStorage: false,
		objectStorageBucket: null,
		objectStoragePrefix: null,
		objectStorageBaseUrl: null,
		objectStorageEndpoint: null,
		objectStorageRegion: null,
		objectStorageAccessKey: null,
		objectStorageSecretKey: null,
		objectStoragePort: null,
		objectStorageUseSSL: false,
		objectStorageUseProxy: false,
		objectStorageSetPublicRead: false,
		objectStorageS3ForcePathStyle: false,
		enableIpLogging: false,
		enableActiveEmailValidation: false,
		enableChartsForRemoteUser: false,
		enableChartsForFederatedInstances: false,
		policies: {},
		serverRules: [],
		...partial,
	} as unknown as Meta;
}

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

describe('NodeinfoServerService', () => {
	let app: TestingModule;
	let fastify: FastifyInstance;
	let nodeinfoServerService: NodeinfoServerService;
	let metaService: jest.Mocked<MetaService>;
	let userEntityService: jest.Mocked<UserEntityService>;
	let notesChart: jest.Mocked<NotesChart>;
	let usersChart: jest.Mocked<UsersChart>;

	beforeEach(async () => {
		metaService = {
			fetch: jest.fn(),
		} as unknown as jest.Mocked<MetaService>;

		userEntityService = {
			pack: jest.fn(),
		} as unknown as jest.Mocked<UserEntityService>;

		notesChart = {
			getChart: jest.fn().mockResolvedValue({
				local: { total: [42] },
			} as unknown as ReturnType<NotesChart['getChart']>),
		} as unknown as jest.Mocked<NotesChart>;

		usersChart = {
			getChart: jest.fn().mockResolvedValue({
				local: { total: [100] },
			} as unknown as ReturnType<UsersChart['getChart']>),
		} as unknown as jest.Mocked<UsersChart>;

		const usersRepository = {} as unknown as jest.Mocked<UsersRepository>;
		const notesRepository = {} as unknown as jest.Mocked<NotesRepository>;
		const config = createConfig();

		app = await Test.createTestingModule({
			providers: [
				NodeinfoServerService,
				{ provide: DI.config, useValue: config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: DI.notesRepository, useValue: notesRepository },
				{ provide: UserEntityService, useValue: userEntityService },
				{ provide: MetaService, useValue: metaService },
				{ provide: NotesChart, useValue: notesChart },
				{ provide: UsersChart, useValue: usersChart },
			],
		}).compile();

		nodeinfoServerService = app.get<NodeinfoServerService>(NodeinfoServerService);
		fastify = Fastify();
		fastify.register(nodeinfoServerService.createServer);
		await fastify.ready();
	});

	afterEach(async () => {
		await fastify.close();
		await app.close();
	});

	describe('getLinks', () => {
		test('returns 2.0 link', () => {
			const links = nodeinfoServerService.getLinks();

			expect(links).toEqual([
				{
					rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
					href: 'https://example.com/nodeinfo/2.0',
				},
			]);
		});
	});

	describe('GET /nodeinfo/2.1', () => {
		test('returns nodeinfo 2.1 with metadata', async () => {
			metaService.fetch.mockResolvedValue(createMeta({
				name: 'Test Instance',
				description: 'A test instance',
				maintainerName: 'Admin',
				maintainerEmail: 'admin@example.com',
				disableRegistration: false,
				repositoryUrl: 'https://example.com/repo',
				feedbackUrl: 'https://example.com/feedback',
				termsOfServiceUrl: 'https://example.com/tos',
				langs: ['ja'],
				enableHcaptcha: true,
				enableRecaptcha: true,
				enableEmail: true,
				policies: { gtlAvailable: false, ltlAvailable: false },
			}));

			const response = await fastify.inject({
				method: 'GET',
				url: '/nodeinfo/2.1',
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers['cache-control']).toBe('public, max-age=600');

			const body = response.json();
			expect(body).toMatchObject({
				version: '2.1',
				software: {
					name: 'misskey',
					version: '13.0.0',
					repository: 'https://example.com/repo',
				},
				protocols: ['activitypub'],
				services: {
					inbound: [],
					outbound: ['atom1.0', 'rss2.0'],
				},
				openRegistrations: true,
				usage: {
					users: { total: 100, activeHalfyear: null, activeMonth: null },
					localPosts: 42,
					localComments: 0,
				},
				metadata: {
					nodeName: 'Test Instance',
					nodeDescription: 'A test instance',
					maintainer: { name: 'Admin', email: 'admin@example.com' },
					langs: ['ja'],
					tosUrl: 'https://example.com/tos',
					repositoryUrl: 'https://example.com/repo',
					feedbackUrl: 'https://example.com/feedback',
					disableRegistration: false,
					disableLocalTimeline: true,
					disableGlobalTimeline: true,
					emailRequiredForSignup: false,
					enableHcaptcha: true,
					enableRecaptcha: true,
					enableEmail: true,
					proxyAccountName: null,
					themeColor: '#86b300',
				},
			});
		});

		test('reflects proxy account name', async () => {
			metaService.fetch.mockResolvedValue(createMeta({ proxyAccountId: 'proxy1' }));
			userEntityService.pack.mockResolvedValue({
				username: 'proxy',
			} as unknown as Packed<'UserLite'>);

			const response = await fastify.inject({
				method: 'GET',
				url: '/nodeinfo/2.1',
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().metadata.proxyAccountName).toBe('proxy');
			expect(userEntityService.pack).toHaveBeenCalledWith('proxy1');
		});

		test('uses cached value on repeated requests', async () => {
			metaService.fetch.mockResolvedValue(createMeta());

			await fastify.inject({ method: 'GET', url: '/nodeinfo/2.1' });
			await fastify.inject({ method: 'GET', url: '/nodeinfo/2.1' });

			expect(metaService.fetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('GET /nodeinfo/2.0', () => {
		test('returns nodeinfo 2.0 without repository field', async () => {
			metaService.fetch.mockResolvedValue(createMeta({
				repositoryUrl: 'https://example.com/repo',
			}));

			const response = await fastify.inject({
				method: 'GET',
				url: '/nodeinfo/2.0',
			});

			expect(response.statusCode).toBe(200);

			const body = response.json();
			expect(body).toMatchObject({
				version: '2.0',
				software: {
					name: 'misskey',
					version: '13.0.0',
				},
			});
			expect(body.software).not.toHaveProperty('repository');
		});
	});
});
