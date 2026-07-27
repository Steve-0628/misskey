process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import AdminMetaEndpoint from '@/server/api/endpoints/admin/meta.js';
import type { MetaService } from '../../../../../src/core/MetaService.js';
import type { Config } from '../../../../../src/config.js';
import type { LocalUser } from '../../../../../src/models/entities/User.js';
import type { Meta } from '../../../../../src/models/entities/Meta.js';

function createLocalUser(partial: Partial<LocalUser> = {}): LocalUser {
	return {
		id: '1',
		createdAt: new Date(),
		updatedAt: null,
		lastFetchedAt: null,
		lastActiveDate: null,
		hideOnlineStatus: false,
		username: 'test',
		usernameLower: 'test',
		name: null,
		followersCount: 0,
		followingCount: 0,
		movedToUri: null,
		isBot: false,
		isCat: false,
		isAdmin: true,
		isModerator: false,
		isLocked: false,
		isSilenced: false,
		isSuspended: false,
		isDeleted: false,
		isLocal: true,
		host: null,
		uri: null,
		inbox: null,
		sharedInbox: null,
		featured: null,
		emojis: [],
		onlineStatus: 'unknown',
		avatarId: null,
		bannerId: null,
		driveCapacityOverrideMb: null,
		...partial,
	} as unknown as LocalUser;
}

function createMeta(partial: Partial<Meta> = {}): Meta {
	return {
		id: 'x',
		name: 'Test Instance',
		maintainerName: null,
		maintainerEmail: null,
		isRoot: true,
		termsOfServiceUrl: null,
		repositoryUrl: 'https://github.com/misskey-dev/misskey',
		feedbackUrl: 'https://github.com/misskey-dev/misskey/issues/new',
		disableRegistration: false,
		emailRequiredForSignup: false,
		enableHcaptcha: false,
		hcaptchaSiteKey: null,
		enableRecaptcha: false,
		recaptchaSiteKey: null,
		enableTurnstile: false,
		turnstileSiteKey: null,
		swPublicKey: null,
		themeColor: null,
		mascotImageUrl: '/assets/ai.png',
		bannerUrl: null,
		serverErrorImageUrl: null,
		notFoundImageUrl: null,
		infoImageUrl: null,
		iconUrl: null,
		backgroundImageUrl: null,
		logoImageUrl: null,
		defaultLightTheme: null,
		defaultDarkTheme: null,
		enableEmail: false,
		deeplAuthKey: null,
		deeplIsPro: false,
		pinnedUsers: [],
		hiddenTags: [],
		blockedHosts: [],
		sensitiveWords: [],
		preservedUsernames: [],
		hcaptchaSecretKey: null,
		recaptchaSecretKey: null,
		turnstileSecretKey: null,
		proxyAccountId: null,
		summalyProxy: null,
		email: null,
		smtpSecure: false,
		smtpHost: null,
		smtpPort: null,
		smtpUser: null,
		smtpPass: null,
		swPrivateKey: null,
		useObjectStorage: false,
		objectStorageBaseUrl: null,
		objectStorageBucket: null,
		objectStoragePrefix: null,
		objectStorageEndpoint: null,
		objectStorageRegion: null,
		objectStoragePort: null,
		objectStorageAccessKey: null,
		objectStorageSecretKey: null,
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

describe('api:admin/meta', () => {
	test('returns instance metadata', async () => {
		const config = { version: '1.0.0', url: 'https://example.com' } as unknown as Config;
		const meta = createMeta({
			name: 'Admin Test',
			maintainerName: 'Admin',
			maintainerEmail: 'admin@example.com',
			enableEmail: true,
			deeplAuthKey: 'secret',
		});
		const metaService = { fetch: jest.fn().mockResolvedValue(meta) } as unknown as MetaService;

		const endpoint = new AdminMetaEndpoint(config, metaService);
		const res = await endpoint.exec({}, createLocalUser(), null);

		expect(metaService.fetch).toHaveBeenCalledWith(true);
		expect(res).toEqual(expect.objectContaining({
			name: 'Admin Test',
			maintainerName: 'Admin',
			maintainerEmail: 'admin@example.com',
			version: '1.0.0',
			uri: 'https://example.com',
			enableEmail: true,
			translatorAvailable: true,
		}));
	});

	test('marks translator as unavailable when deeplAuthKey is null', async () => {
		const config = { version: '1.0.0', url: 'https://example.com' } as unknown as Config;
		const meta = createMeta({
			deeplAuthKey: null,
		});
		const metaService = { fetch: jest.fn().mockResolvedValue(meta) } as unknown as MetaService;

		const endpoint = new AdminMetaEndpoint(config, metaService);
		const res = await endpoint.exec({}, createLocalUser(), null);

		expect(res).toEqual(expect.objectContaining({
			translatorAvailable: false,
		}));
	});

	test('merges default policies with instance policies', async () => {
		const config = { version: '1.0.0', url: 'https://example.com' } as unknown as Config;
		const meta = createMeta({
			policies: { gtlAvailable: false },
		});
		const metaService = { fetch: jest.fn().mockResolvedValue(meta) } as unknown as MetaService;

		const endpoint = new AdminMetaEndpoint(config, metaService);
		const res = await endpoint.exec({}, createLocalUser(), null);

		expect(res.policies).toEqual(expect.objectContaining({
			gtlAvailable: false,
		}));
	});

	test('returns arrays for pinnedUsers, hiddenTags, blockedHosts and sensitiveWords', async () => {
		const config = { version: '1.0.0', url: 'https://example.com' } as unknown as Config;
		const meta = createMeta({
			pinnedUsers: ['alice'],
			hiddenTags: ['nsfw'],
			blockedHosts: ['evil.example'],
			sensitiveWords: ['bad'],
		});
		const metaService = { fetch: jest.fn().mockResolvedValue(meta) } as unknown as MetaService;

		const endpoint = new AdminMetaEndpoint(config, metaService);
		const res = await endpoint.exec({}, createLocalUser(), null);

		expect(res).toEqual(expect.objectContaining({
			pinnedUsers: ['alice'],
			hiddenTags: ['nsfw'],
			blockedHosts: ['evil.example'],
			sensitiveWords: ['bad'],
		}));
	});
});
