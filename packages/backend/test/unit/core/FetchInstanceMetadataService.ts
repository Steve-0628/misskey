process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { FetchInstanceMetadataService } from '@/core/FetchInstanceMetadataService.js';
import { DI } from '@/di-symbols.js';
import { Instance } from '@/models/entities/Instance.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import type { Config } from '@/config.js';
import type { TestingModule } from '@nestjs/testing';

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
		userAgent: 'TestAgent/1.0',
		clientEntry: {},
		clientManifestExists: false,
		mediaProxy: 'https://example.com/proxy',
		externalMediaProxyEnabled: false,
		videoThumbnailGenerator: null,
		redis: { host: 'localhost', port: 6379, pass: '' },
		redisForPubsub: { host: 'localhost', port: 6379, pass: '' },
		redisForJobQueue: { host: 'localhost', port: 6379, pass: '' },
		db: { host: 'localhost', port: 5432, db: 'misskey', user: 'misskey', pass: '' },
		id: 'aid',
	} as unknown as Config;
}

function createInstance(data: Partial<Instance> = {}): Instance {
	return {
		id: 'instance1',
		host: 'remote.example',
		firstRetrievedAt: new Date(),
		...data,
	} as Instance;
}

describe('FetchInstanceMetadataService', () => {
	let app: TestingModule;
	let fetchInstanceMetadataService: FetchInstanceMetadataService;
	let httpRequestService: jest.Mocked<HttpRequestService>;
	let federatedInstanceService: jest.Mocked<FederatedInstanceService>;
	let redisClient: { set: jest.Mock };

	beforeEach(async () => {
		httpRequestService = {
			getJson: jest.fn(),
			getHtml: jest.fn(),
			send: jest.fn(),
		} as unknown as jest.Mocked<HttpRequestService>;

		federatedInstanceService = {
			fetch: jest.fn(),
			update: jest.fn(),
		} as unknown as jest.Mocked<FederatedInstanceService>;

		redisClient = {
			set: jest.fn().mockResolvedValue('0'),
		};

		const loggerService = {
			getLogger: jest.fn().mockReturnValue({
				info: jest.fn(),
				succ: jest.fn(),
				error: jest.fn(),
			}),
		} as unknown as jest.Mocked<LoggerService>;

		app = await Test.createTestingModule({
			providers: [
				FetchInstanceMetadataService,
				{ provide: DI.config, useValue: createConfig() },
				{ provide: HttpRequestService, useValue: httpRequestService },
				{ provide: LoggerService, useValue: loggerService },
				{ provide: FederatedInstanceService, useValue: federatedInstanceService },
				{ provide: DI.redis, useValue: redisClient },
			],
		}).compile();

		fetchInstanceMetadataService = app.get<FetchInstanceMetadataService>(FetchInstanceMetadataService);
	});

	afterEach(async () => {
		await app.close();
	});

	describe('tryLock', () => {
		test('returns true when mutex was not set', async () => {
			redisClient.set.mockResolvedValue(null);

			const result = await fetchInstanceMetadataService.tryLock('remote.example');

			expect(result).toBe(true);
			expect(redisClient.set).toHaveBeenCalledWith('fetchInstanceMetadata:mutex:remote.example', '1', 'GET');
		});

		test('returns false when mutex was already set', async () => {
			redisClient.set.mockResolvedValue('1');

			const result = await fetchInstanceMetadataService.tryLock('remote.example');

			expect(result).toBe(false);
		});
	});

	describe('fetchInstanceMetadata', () => {
		test('returns early when mutex is already held', async () => {
			redisClient.set.mockResolvedValue('1');

			await fetchInstanceMetadataService.fetchInstanceMetadata(createInstance());

			expect(federatedInstanceService.fetch).not.toHaveBeenCalled();
		});

		test('skips fetch when info was recently updated', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(createInstance({ infoUpdatedAt: new Date() }));

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(httpRequestService.getJson).not.toHaveBeenCalled();
			expect(federatedInstanceService.update).not.toHaveBeenCalled();
		});

		test('fetches when info is stale', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(createInstance({ infoUpdatedAt: new Date(Date.now() - 1000 * 60 * 60 * 25) }));
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					return {
						links: [
							{ rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0', href: 'https://remote.example/nodeinfo/2.0' },
						],
					};
				}
				if (url === 'https://remote.example/nodeinfo/2.0') {
					return {
						software: { name: 'misskey', version: '13.0.0' },
						openRegistrations: true,
						metadata: {
							nodeName: 'Remote Instance',
							nodeDescription: 'A remote instance',
							maintainer: { name: 'Admin', email: 'admin@remote.example' },
							themeColor: '#ff0000',
						},
					};
				}
				if (url === 'https://remote.example/manifest.json') {
					return { name: 'Remote Instance', icons: [{ src: '/icon.png' }] };
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				softwareName: 'misskey',
				softwareVersion: '13.0.0',
				openRegistrations: true,
				name: 'Remote Instance',
				description: 'A remote instance',
				maintainerName: 'Admin',
				maintainerEmail: 'admin@remote.example',
				themeColor: '#ff0000',
				iconUrl: 'https://remote.example/icon.png',
				infoUpdatedAt: expect.any(Date),
			}));
		});

		test('forces fetch even when recently updated', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(createInstance({ infoUpdatedAt: new Date() }));
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					return { links: [] };
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance, true);

			expect(httpRequestService.getJson).toHaveBeenCalled();
		});

		test('uses fallback nodeinfo link versions', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					return {
						links: [
							{ rel: 'http://nodeinfo.diaspora.software/ns/schema/1.0', href: 'https://remote.example/nodeinfo/1.0' },
						],
					};
				}
				if (url === 'https://remote.example/nodeinfo/1.0') {
					return { software: { name: ' Mastodon ', version: '4.0' } };
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				softwareName: ' mastodon ',
				softwareVersion: '4.0',
			}));
		});

		test('uses nodeinfo metadata name and description fields', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					return {
						links: [{ rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1', href: 'https://remote.example/nodeinfo/2.1' }],
					};
				}
				if (url === 'https://remote.example/nodeinfo/2.1') {
					return {
						software: { name: 'pleroma', version: '2.0' },
						metadata: {
							name: 'Pleroma Instance',
							description: 'Pleroma description',
						},
					};
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				name: 'Pleroma Instance',
				description: 'Pleroma description',
			}));
		});

		test('extracts site name from HTML meta tags', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					throw new Error('No nodeinfo provided');
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html><head><meta property="og:title" content="HTML Site Name"></head><body></body></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				name: 'HTML Site Name',
			}));
		});

		test('extracts description from HTML description meta tag', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					throw new Error('No nodeinfo provided');
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html><head><meta name="description" content="HTML description"></head><body></body></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				description: 'HTML description',
			}));
		});

		test('extracts theme color from HTML meta tag', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					throw new Error('No nodeinfo provided');
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html><head><meta name="theme-color" content="#00ff00"></head><body></body></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				themeColor: '#00ff00',
			}));
		});

		test('uses manifest for site name and icon', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					throw new Error('No nodeinfo provided');
				}
				if (url === 'https://remote.example/manifest.json') {
					return {
						name: 'Manifest Site',
						short_name: 'MS',
						icons: [{ src: '/manifest-icon.png' }],
						theme_color: '#0000ff',
					};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				name: 'Manifest Site',
				iconUrl: 'https://remote.example/manifest-icon.png',
				themeColor: '#0000ff',
			}));
		});

		test('falls back to favicon.ico when no icon is found', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					throw new Error('No nodeinfo provided');
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/favicon.ico') {
					return { ok: true } as Response;
				}
				return { ok: false } as Response;
			});

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				iconUrl: 'https://remote.example/favicon.ico',
				faviconUrl: 'https://remote.example/favicon.ico',
			}));
		});

		test('uses HTML link icon over favicon.ico', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					throw new Error('No nodeinfo provided');
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html><head><link rel="icon" href="/html-icon.png"></head><body></body></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				iconUrl: 'https://remote.example/html-icon.png',
				faviconUrl: 'https://remote.example/html-icon.png',
			}));
		});

		test('skips base64 data icons in manifest', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					throw new Error('No nodeinfo provided');
				}
				if (url === 'https://remote.example/manifest.json') {
					return {
						icons: [{ src: 'data:image/png;base64,abc' }],
					};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/favicon.ico') {
					return { ok: true } as Response;
				}
				return { ok: false } as Response;
			});

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				iconUrl: 'https://remote.example/favicon.ico',
				faviconUrl: 'https://remote.example/favicon.ico',
			}));
		});

		test('handles nodeinfo 404 gracefully', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					const err = new Error('Not Found') as Error & { statusCode: number };
					err.statusCode = 404;
					throw err;
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await expect(fetchInstanceMetadataService.fetchInstanceMetadata(instance)).resolves.toBeUndefined();
			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				infoUpdatedAt: expect.any(Date),
			}));
		});

		test('handles unexpected errors during fetch gracefully', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockRejectedValue(new Error('DB failure'));

			await expect(fetchInstanceMetadataService.fetchInstanceMetadata(instance)).resolves.toBeUndefined();
		});

		test('unlocks mutex even when errors occur', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockRejectedValue(new Error('DB failure'));

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(redisClient.set).toHaveBeenLastCalledWith('fetchInstanceMetadata:mutex:remote.example', '0');
		});

		test('uses favicon.ico when DOM fetch fails', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					throw new Error('No nodeinfo provided');
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockRejectedValue(new Error('network error'));
			httpRequestService.send.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/favicon.ico') {
					return { ok: true } as Response;
				}
				return { ok: false } as Response;
			});

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				iconUrl: 'https://remote.example/favicon.ico',
				faviconUrl: 'https://remote.example/favicon.ico',
			}));
		});

		test('uses nodeName over name in nodeinfo metadata', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					return { links: [{ rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0', href: 'https://remote.example/nodeinfo/2.0' }] };
				}
				if (url === 'https://remote.example/nodeinfo/2.0') {
					return {
						software: { name: 'misskey', version: '13.0.0' },
						metadata: { nodeName: 'Node Name', name: 'Name', nodeDescription: 'Node Desc', description: 'Desc' },
					};
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				name: 'Node Name',
				description: 'Node Desc',
			}));
		});

		test('skips invalid theme colors', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					return { links: [{ rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0', href: 'https://remote.example/nodeinfo/2.0' }] };
				}
				if (url === 'https://remote.example/nodeinfo/2.0') {
					return {
						software: { name: 'misskey', version: '13.0.0' },
						metadata: { themeColor: 'not-a-color' },
					};
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update.mock.calls[0][1]).not.toHaveProperty('themeColor');
		});

		test('falls back to manifest short_name for site name and description', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					throw new Error('No nodeinfo provided');
				}
				if (url === 'https://remote.example/manifest.json') {
					return { short_name: 'Short' };
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				name: 'Short',
				description: 'Short',
			}));
		});

		test('handles missing wellknown links', async () => {
			const instance = createInstance();
			redisClient.set.mockResolvedValue('0');
			federatedInstanceService.fetch.mockResolvedValue(null);
			httpRequestService.getJson.mockImplementation(async (url: string) => {
				if (url === 'https://remote.example/.well-known/nodeinfo') {
					return { links: 'not-an-array' };
				}
				if (url === 'https://remote.example/manifest.json') {
					return {};
				}
				return null;
			});
			httpRequestService.getHtml.mockResolvedValue('<html></html>');
			httpRequestService.send.mockResolvedValue({ ok: false } as Response);

			await fetchInstanceMetadataService.fetchInstanceMetadata(instance);

			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				infoUpdatedAt: expect.any(Date),
			}));
		});
	});
});
