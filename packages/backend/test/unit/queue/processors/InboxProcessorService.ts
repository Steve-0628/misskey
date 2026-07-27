process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type Bull from 'bull';
import type { IParsedSignature } from '@peertube/http-signature';
import type { InboxProcessorService as InboxProcessorServiceType } from '@/queue/processors/InboxProcessorService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { InstancesRepository, DriveFilesRepository } from '@/models/index.js';
import type { Meta } from '@/models/entities/Meta.js';
import { User } from '@/models/entities/User.js';
import { UserPublickey } from '@/models/entities/UserPublickey.js';
import type { Instance } from '@/models/entities/Instance.js';
import type { RemoteUser } from '@/models/entities/User.js';
import type { IActivity } from '@/core/activitypub/type.js';
import { UtilityService } from '@/core/UtilityService.js';
import { MetaService } from '@/core/MetaService.js';
import { ApInboxService } from '@/core/activitypub/ApInboxService.js';
import { FederatedInstanceService } from '@/core/FederatedInstanceService.js';
import { FetchInstanceMetadataService } from '@/core/FetchInstanceMetadataService.js';
import { JsonLdService } from '@/core/activitypub/JsonLdService.js';
import { ApRequestService } from '@/core/activitypub/ApRequestService.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { ApDbResolverService } from '@/core/activitypub/ApDbResolverService.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import ApRequestChart from '@/core/chart/charts/ap-request.js';
import FederationChart from '@/core/chart/charts/federation.js';
import { QueueLoggerService } from '@/queue/QueueLoggerService.js';
import { StatusError } from '@/misc/status-error.js';
import type { InboxJobData } from '@/queue/types.js';
import type { TestingModule } from '@nestjs/testing';

jest.unstable_mockModule('@peertube/http-signature', () => {
	const verifySignature = jest.fn();
	return {
		default: { verifySignature },
		verifySignature,
	};
});

const { InboxProcessorService } = await import('@/queue/processors/InboxProcessorService.js');
const httpSignature = await import('@peertube/http-signature');

function createConfig(partial: Partial<Config> = {}): Config {
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
		userAgent: 'Test/1.0',
		clientEntry: '/client',
		clientManifestExists: false,
		mediaProxy: 'https://example.com/proxy',
		externalMediaProxyEnabled: false,
		videoThumbnailGenerator: null,
		redis: { host: 'localhost', port: 6379, pass: '' },
		redisForPubsub: { host: 'localhost', port: 6379, pass: '' },
		redisForJobQueue: { host: 'localhost', port: 6379, pass: '' },
		db: { host: 'localhost', port: 5432, db: 'misskey', user: 'misskey', pass: '' },
		id: 'aaaaaaaa',
		...partial,
	} as Config;
}

function createMeta(partial: Partial<Meta> = {}): Meta {
	return {
		id: 'x',
		blockedHosts: [],
		...partial,
	} as Meta;
}

function createRemoteUser(partial: Partial<User> = {}): RemoteUser {
	const defaults: Partial<User> = {
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
		host: 'remote.example',
		inbox: 'https://remote.example/inbox',
		sharedInbox: 'https://remote.example/inbox',
		featured: null,
		uri: 'https://remote.example/users/alice',
		followersUri: null,
		token: null,
	};
	return new User({ ...defaults, ...partial }) as RemoteUser;
}

function createUserPublickey(partial: Partial<UserPublickey> = {}): UserPublickey {
	const defaults: Partial<UserPublickey> = {
		userId: 'user1',
		user: null,
		keyId: 'https://remote.example/users/alice#main-key',
		keyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
	};
	return new UserPublickey({ ...defaults, ...partial });
}

function createInstance(partial: Partial<Instance> = {}): Instance {
	return {
		id: 'instance1',
		firstRetrievedAt: new Date(),
		host: 'remote.example',
		usersCount: 0,
		notesCount: 0,
		followingCount: 0,
		followersCount: 0,
		latestRequestReceivedAt: null,
		isNotResponding: false,
		isSuspended: false,
		softwareName: null,
		softwareVersion: null,
		openRegistrations: null,
		name: null,
		description: null,
		maintainerName: null,
		maintainerEmail: null,
		iconUrl: null,
		faviconUrl: null,
		themeColor: null,
		infoUpdatedAt: null,
		...partial,
	} as Instance;
}

function createParsedSignature(partial: Partial<IParsedSignature> = {}): IParsedSignature {
	return {
		scheme: 'Signature',
		params: {
			keyId: 'https://remote.example/users/alice#main-key',
			algorithm: 'rsa-sha256',
			headers: ['(request-target)', 'date', 'host', 'digest'],
			signature: 'sig',
		},
		signingString: 'signing-string',
		algorithm: 'RSA-SHA256',
		keyId: 'https://remote.example/users/alice#main-key',
		...partial,
	};
}

function createActivity(partial: Partial<IActivity> = {}): IActivity {
	return {
		type: 'Create',
		actor: 'https://remote.example/users/alice',
		object: {
			type: 'Note',
			id: 'https://remote.example/notes/note1',
		},
		id: 'https://remote.example/activities/1',
		...partial,
	};
}

function createMockLogger() {
	return {
		info: jest.fn(),
		succ: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
		createSubLogger: jest.fn().mockReturnValue({
			info: jest.fn(),
			succ: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		}),
	};
}

function createJob(data: InboxJobData): Bull.Job<InboxJobData> {
	return {
		data,
		discard: jest.fn(),
	} as unknown as Bull.Job<InboxJobData>;
}

describe('InboxProcessorService', () => {
	let app: TestingModule;
	let service: InboxProcessorServiceType;
	let metaService: jest.Mocked<MetaService>;
	let utilityService: jest.Mocked<UtilityService>;
	let apInboxService: jest.Mocked<ApInboxService>;
	let apDbResolverService: jest.Mocked<ApDbResolverService>;
	let apPersonService: jest.Mocked<ApPersonService>;
	let jsonLdService: jest.Mocked<JsonLdService>;
	let federatedInstanceService: jest.Mocked<FederatedInstanceService>;
	let fetchInstanceMetadataService: jest.Mocked<FetchInstanceMetadataService>;
	let instanceChart: jest.Mocked<InstanceChart>;
	let apRequestChart: jest.Mocked<ApRequestChart>;
	let federationChart: jest.Mocked<FederationChart>;

	beforeEach(async () => {
		const config = createConfig();

		const instancesRepository: jest.Mocked<InstancesRepository> = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<InstancesRepository>;

		const driveFilesRepository: jest.Mocked<DriveFilesRepository> = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<DriveFilesRepository>;

		metaService = {
			fetch: jest.fn().mockResolvedValue(createMeta()),
			update: jest.fn(),
		} as unknown as jest.Mocked<MetaService>;

		utilityService = {
			toPuny: jest.fn((host: string) => host.toLowerCase()),
			extractDbHost: jest.fn((uri: string) => new URL(uri).hostname),
			isBlockedHost: jest.fn((blockedHosts: string[], host: string | null) => {
				if (host == null) return false;
				return blockedHosts.some(x => `.${host.toLowerCase()}`.endsWith(`.${x}`));
			}),
			isSelfHost: jest.fn(),
			getFullApAccount: jest.fn(),
			toPunyNullable: jest.fn(),
		} as unknown as jest.Mocked<UtilityService>;

		apInboxService = {
			performActivity: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<ApInboxService>;

		apDbResolverService = {
			getAuthUserFromKeyId: jest.fn(),
			getAuthUserFromApId: jest.fn(),
		} as unknown as jest.Mocked<ApDbResolverService>;

		apPersonService = {
			resolvePerson: jest.fn(),
			updatePerson: jest.fn(),
		} as unknown as jest.Mocked<ApPersonService>;

		jsonLdService = {
			use: jest.fn().mockReturnValue({
				verifyRsaSignature2017: jest.fn().mockResolvedValue(true),
				compact: jest.fn().mockImplementation(async (activity: IActivity) => activity),
			}),
		} as unknown as jest.Mocked<JsonLdService>;

		federatedInstanceService = {
			fetch: jest.fn().mockResolvedValue(createInstance()),
			update: jest.fn().mockResolvedValue(undefined),
			dispose: jest.fn(),
		} as unknown as jest.Mocked<FederatedInstanceService>;

		fetchInstanceMetadataService = {
			fetchInstanceMetadata: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<FetchInstanceMetadataService>;

		const apRequestService: jest.Mocked<ApRequestService> = {
			createSignedPost: jest.fn(),
			createSignedGet: jest.fn(),
		} as unknown as jest.Mocked<ApRequestService>;

		instanceChart = {
			requestReceived: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<InstanceChart>;

		apRequestChart = {
			inbox: jest.fn().mockResolvedValue(undefined),
			deliverSucc: jest.fn().mockResolvedValue(undefined),
			deliverFail: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<ApRequestChart>;

		federationChart = {
			inbox: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<FederationChart>;

		const queueLoggerService: jest.Mocked<QueueLoggerService> = {
			logger: createMockLogger(),
		} as unknown as jest.Mocked<QueueLoggerService>;

		app = await Test.createTestingModule({
			providers: [
				InboxProcessorService,
				{ provide: DI.config, useValue: config },
				{ provide: DI.instancesRepository, useValue: instancesRepository },
				{ provide: DI.driveFilesRepository, useValue: driveFilesRepository },
				{ provide: MetaService, useValue: metaService },
				{ provide: UtilityService, useValue: utilityService },
				{ provide: ApInboxService, useValue: apInboxService },
				{ provide: ApDbResolverService, useValue: apDbResolverService },
				{ provide: ApPersonService, useValue: apPersonService },
				{ provide: JsonLdService, useValue: jsonLdService },
				{ provide: FederatedInstanceService, useValue: federatedInstanceService },
				{ provide: FetchInstanceMetadataService, useValue: fetchInstanceMetadataService },
				{ provide: ApRequestService, useValue: apRequestService },
				{ provide: InstanceChart, useValue: instanceChart },
				{ provide: ApRequestChart, useValue: apRequestChart },
				{ provide: FederationChart, useValue: federationChart },
				{ provide: QueueLoggerService, useValue: queueLoggerService },
			],
		}).compile();

		service = app.get<InboxProcessorServiceType>(InboxProcessorService);
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	describe('blocked host handling', () => {
		test('returns blocked message when signer host is blocked', async () => {
			metaService.fetch.mockResolvedValue(createMeta({ blockedHosts: ['remote.example'] }));

			const result = await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('Blocked request: remote.example');
			expect(apInboxService.performActivity).not.toHaveBeenCalled();
		});

		test('returns blocked message when LD-signature host is blocked', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			metaService.fetch.mockResolvedValue(createMeta({ blockedHosts: ['remote.example'] }));
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});
			jsonLdService.use.mockReturnValue({
				verifyRsaSignature2017: jest.fn().mockResolvedValue(true),
				compact: jest.fn().mockImplementation(async (activity: IActivity) => activity),
			});

			const result = await service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'RsaSignature2017',
						created: new Date(),
						creator: 'https://remote.example/users/alice#main-key',
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('Blocked request: remote.example');
		});
	});

	describe('keyId handling', () => {
		test('rejects old acct: keyId format', async () => {
			const result = await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature({ keyId: 'acct:alice@remote.example' }),
			}));

			expect(result).toBe('Old keyId is no longer supported. acct:alice@remote.example');
		});
	});

	describe('auth user resolution', () => {
		test('skips when auth user cannot be resolved', async () => {
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue(null);
			apDbResolverService.getAuthUserFromApId.mockResolvedValue(null);

			const result = await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: failed to resolve user');
			expect(apDbResolverService.getAuthUserFromApId).toHaveBeenCalledWith('https://remote.example/users/alice');
		});

		test('skips when public key is missing', async () => {
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: null,
			});

			const result = await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: failed to resolve user publicKey');
		});

		test('resolves auth user from activity actor when keyId lookup fails', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(true);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue(null);
			apDbResolverService.getAuthUserFromApId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});

			const result = await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('ok');
			expect(apDbResolverService.getAuthUserFromApId).toHaveBeenCalledWith('https://remote.example/users/alice');
			expect(apInboxService.performActivity).toHaveBeenCalled();
		});

		test('skips deleted actors on client error', async () => {
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue(null);
			apDbResolverService.getAuthUserFromApId.mockRejectedValue(new StatusError('Not Found', 404));

			const result = await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: Ignored deleted actors on both ends https://remote.example/users/alice - 404');
		});

		test('throws non-client status errors', async () => {
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue(null);
			apDbResolverService.getAuthUserFromApId.mockRejectedValue(new StatusError('Server Error', 500));

			await expect(service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}))).rejects.toThrow('Error in actor https://remote.example/users/alice - 500');
		});
	});

	describe('signature validation', () => {
		test('processes activity when HTTP-signature is valid and actor matches', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(true);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});

			const result = await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('ok');
			expect(apInboxService.performActivity).toHaveBeenCalledWith(
				expect.objectContaining({ uri: 'https://remote.example/users/alice' }),
				expect.objectContaining({ type: 'Create' }),
			);
		});

		test('skips when HTTP-signature verification fails and no LD-signature', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});

			const result = await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: http-signature verification failed and no LD-Signature. keyId=https://remote.example/users/alice#main-key');
		});

		test('skips when HTTP-signature is valid but actor mismatch and no LD-signature', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(true);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});

			const result = await service.process(createJob({
				activity: createActivity({ actor: 'https://other.example/users/alice' }),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: http-signature verification failed and no LD-Signature. keyId=https://remote.example/users/alice#main-key');
		});

		test('skips LD-signature when creator is missing', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			apDbResolverService.getAuthUserFromKeyId
				.mockResolvedValueOnce({
					user: createRemoteUser(),
					key: createUserPublickey(),
				})
				.mockResolvedValue(null);

			const result = await service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'RsaSignature2017',
						created: new Date(),
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: LD-Signatureのユーザーが取得できませんでした');
		});

		test('skips when LD-signature type is unsupported', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});

			const result = await service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'Ed25519Signature2020',
						created: new Date(),
						creator: 'https://remote.example/users/alice#main-key',
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: unsupported LD-signature type Ed25519Signature2020');
		});

		test('skips when LD-signature user cannot be resolved', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValueOnce({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue(null);
			apPersonService.resolvePerson.mockResolvedValue(createRemoteUser());

			const result = await service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'RsaSignature2017',
						created: new Date(),
						creator: 'https://remote.example/users/alice#main-key',
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: LD-Signatureのユーザーが取得できませんでした');
		});

		test('skips when LD-signature user has no public key', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValueOnce({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: null,
			});
			apPersonService.resolvePerson.mockResolvedValue(createRemoteUser());

			const result = await service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'RsaSignature2017',
						created: new Date(),
						creator: 'https://remote.example/users/alice#main-key',
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: LD-SignatureのユーザーはpublicKeyを持っていませんでした');
		});

		test('skips when LD-signature verification fails', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValueOnce({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});
			apPersonService.resolvePerson.mockResolvedValue(createRemoteUser());
			jsonLdService.use.mockReturnValue({
				verifyRsaSignature2017: jest.fn().mockResolvedValue(false),
				compact: jest.fn().mockImplementation(async (activity: IActivity) => activity),
			});

			const result = await service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'RsaSignature2017',
						created: new Date(),
						creator: 'https://remote.example/users/alice#main-key',
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: LD-Signatureの検証に失敗しました');
		});

		test('processes activity via valid LD-signature', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});
			apPersonService.resolvePerson.mockResolvedValue(createRemoteUser());

			const result = await service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'RsaSignature2017',
						created: new Date(),
						creator: 'https://remote.example/users/alice#main-key',
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('ok');
			expect(apInboxService.performActivity).toHaveBeenCalled();
		});
	});

	describe('activity id host validation', () => {
		test('skips when activity.id host does not match signer host', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(true);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser({ host: 'remote.example', uri: 'https://remote.example/users/alice' }),
				key: createUserPublickey(),
			});

			const result = await service.process(createJob({
				activity: createActivity({ id: 'https://other.example/activities/1' }),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: signerHost(remote.example) !== activity.id host(other.example');
		});
	});

	describe('activity processing', () => {
		beforeEach(() => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(true);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});
		});

		test.each([
			['Create'],
			['Delete'],
			['Follow'],
			['Accept'],
			['Reject'],
			['Announce'],
			['Like'],
			['Undo'],
			['Update'],
			['Add'],
			['Remove'],
			['Block'],
			['Flag'],
			['Move'],
		])('passes %s activity to ApInboxService', async (type) => {
			const result = await service.process(createJob({
				activity: createActivity({ type }),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('ok');
			expect(apInboxService.performActivity).toHaveBeenCalledWith(
				expect.objectContaining({ uri: 'https://remote.example/users/alice' }),
				expect.objectContaining({ type }),
			);
		});

		test('updates instance stats after successful processing', async () => {
			metaService.fetch.mockResolvedValue(createMeta({ enableChartsForFederatedInstances: true }));

			await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}));

			expect(federatedInstanceService.fetch).toHaveBeenCalledWith('remote.example');
			expect(federatedInstanceService.update).toHaveBeenCalledWith('instance1', expect.objectContaining({
				latestRequestReceivedAt: expect.any(Date),
				isNotResponding: false,
			}));
			expect(fetchInstanceMetadataService.fetchInstanceMetadata).toHaveBeenCalled();
			expect(apRequestChart.inbox).toHaveBeenCalled();
			expect(federationChart.inbox).toHaveBeenCalledWith('remote.example');
			expect(instanceChart.requestReceived).toHaveBeenCalledWith('remote.example');
		});

		test('skips instanceChart when federated instance charts disabled', async () => {
			metaService.fetch.mockResolvedValue(createMeta({ enableChartsForFederatedInstances: false }));

			await service.process(createJob({
				activity: createActivity(),
				signature: createParsedSignature(),
			}));

			expect(instanceChart.requestReceived).not.toHaveBeenCalled();
		});
	});

	describe('LD-signature edge cases', () => {
		test('skips when LD-signature actor does not match activity actor', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser({ uri: 'https://other.example/users/alice' }),
				key: createUserPublickey(),
			});
			apPersonService.resolvePerson.mockResolvedValue(createRemoteUser({ uri: 'https://other.example/users/alice' }));

			const result = await service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'RsaSignature2017',
						created: new Date(),
						creator: 'https://remote.example/users/alice#main-key',
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('skip: LD-Signature user(https://other.example/users/alice) !== activity.actor(https://remote.example/users/alice)');
		});

		test('blocks LD-signature host when blocked', async () => {
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			metaService.fetch.mockResolvedValue(createMeta({ blockedHosts: ['remote.example'] }));
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});

			const result = await service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'RsaSignature2017',
						created: new Date(),
						creator: 'https://remote.example/users/alice#main-key',
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}));

			expect(result).toBe('Blocked request: remote.example');
		});

		test('discards job when compact fails', async () => {
			const discard = jest.fn();
			(httpSignature.verifySignature as jest.Mock).mockReturnValue(false);
			apDbResolverService.getAuthUserFromKeyId.mockResolvedValue({
				user: createRemoteUser(),
				key: createUserPublickey(),
			});
			jsonLdService.use.mockReturnValue({
				verifyRsaSignature2017: jest.fn().mockResolvedValue(true),
				compact: jest.fn().mockRejectedValue(new Error('compact failed')),
			});

			await expect(service.process(createJob({
				activity: createActivity({
					signature: {
						type: 'RsaSignature2017',
						created: new Date(),
						creator: 'https://remote.example/users/alice#main-key',
						signatureValue: 'sig',
					},
				}),
				signature: createParsedSignature(),
			}) as any)).rejects.toThrow();
		});
	});
});
