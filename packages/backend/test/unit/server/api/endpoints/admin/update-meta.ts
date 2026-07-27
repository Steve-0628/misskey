process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import AdminUpdateMetaEndpoint from '@/server/api/endpoints/admin/update-meta.js';
import type { MetaService } from '../../../../../src/core/MetaService.js';
import type { ModerationLogService } from '../../../../../src/core/ModerationLogService.js';
import type { DataSource } from 'typeorm';
import type { LocalUser } from '../../../../../src/models/entities/User.js';

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

function createEndpoint(deps: {
	metaService?: Partial<MetaService>;
	moderationLogService?: Partial<ModerationLogService>;
}) {
	const metaService = {
		update: jest.fn().mockResolvedValue(undefined),
		...deps.metaService,
	} as unknown as MetaService;

	const moderationLogService = {
		insertModerationLog: jest.fn().mockResolvedValue(undefined),
		...deps.moderationLogService,
	} as unknown as ModerationLogService;

	const db = {} as unknown as DataSource;

	const endpoint = new AdminUpdateMetaEndpoint(db, metaService, moderationLogService);
	return { endpoint, metaService, moderationLogService };
}

describe('api:admin/update-meta', () => {
	test('updates instance metadata with all supported fields', async () => {
		const { endpoint, metaService, moderationLogService } = createEndpoint({});

		const params = {
			disableRegistration: true,
			pinnedUsers: ['alice', 'bob'],
			hiddenTags: ['nsfw'],
			blockedHosts: ['EXAMPLE.COM'],
			sensitiveWords: ['bad'],
			themeColor: '#ff0000',
			mascotImageUrl: '/assets/ai.png',
			bannerUrl: 'https://example.com/banner.png',
			iconUrl: 'https://example.com/icon.png',
			serverErrorImageUrl: 'https://example.com/500.png',
			infoImageUrl: 'https://example.com/info.png',
			notFoundImageUrl: 'https://example.com/404.png',
			backgroundImageUrl: 'https://example.com/bg.png',
			logoImageUrl: 'https://example.com/logo.png',
			name: 'Test Instance',
			description: 'A test instance',
			defaultLightTheme: '{}',
			defaultDarkTheme: '{}',
			emailRequiredForSignup: true,
			enableHcaptcha: true,
			hcaptchaSiteKey: 'site',
			hcaptchaSecretKey: 'secret',
			enableRecaptcha: false,
			recaptchaSiteKey: null,
			recaptchaSecretKey: null,
			enableTurnstile: true,
			turnstileSiteKey: 'ts-site',
			turnstileSecretKey: 'ts-secret',
			proxyAccountId: 'proxyid',
			maintainerName: 'Admin',
			maintainerEmail: 'admin@example.com',
			langs: ['ja', 'en'],
			summalyProxy: 'https://summaly.example.com',
			enableEmail: true,
			email: 'noreply@example.com',
			smtpSecure: true,
			smtpHost: 'smtp.example.com',
			smtpPort: 587,
			smtpUser: 'user',
			smtpPass: 'pass',
			swPublicKey: 'pub',
			swPrivateKey: 'priv',
			tosUrl: 'https://example.com/tos',
			repositoryUrl: 'https://example.com/repo',
			feedbackUrl: 'https://example.com/feedback',
			useObjectStorage: true,
			objectStorageBaseUrl: 'https://obj.example.com',
			objectStorageBucket: 'bucket',
			objectStoragePrefix: 'prefix',
			objectStorageEndpoint: 's3.example.com',
			objectStorageRegion: 'ap-northeast-1',
			objectStoragePort: 9000,
			objectStorageAccessKey: 'access',
			objectStorageSecretKey: 'secret2',
			objectStorageUseSSL: true,
			objectStorageUseProxy: true,
			objectStorageSetPublicRead: true,
			objectStorageS3ForcePathStyle: true,
			deeplAuthKey: 'deepl-key',
			deeplIsPro: true,
			enableIpLogging: true,
			enableActiveEmailValidation: true,
			enableChartsForRemoteUser: true,
			enableChartsForFederatedInstances: true,
			serverRules: ['be nice'],
			preservedUsernames: ['admin'],
		};

		const me = createLocalUser();
		const res = await endpoint.exec(params, me, null);

		expect(res).toBeUndefined();
		expect(metaService.update).toHaveBeenCalledWith({
			disableRegistration: true,
			pinnedUsers: ['alice', 'bob'],
			hiddenTags: ['nsfw'],
			blockedHosts: ['example.com'],
			sensitiveWords: ['bad'],
			themeColor: '#ff0000',
			mascotImageUrl: '/assets/ai.png',
			bannerUrl: 'https://example.com/banner.png',
			iconUrl: 'https://example.com/icon.png',
			serverErrorImageUrl: 'https://example.com/500.png',
			infoImageUrl: 'https://example.com/info.png',
			notFoundImageUrl: 'https://example.com/404.png',
			backgroundImageUrl: 'https://example.com/bg.png',
			logoImageUrl: 'https://example.com/logo.png',
			name: 'Test Instance',
			description: 'A test instance',
			defaultLightTheme: '{}',
			defaultDarkTheme: '{}',
			emailRequiredForSignup: true,
			enableHcaptcha: true,
			hcaptchaSiteKey: 'site',
			hcaptchaSecretKey: 'secret',
			enableRecaptcha: false,
			recaptchaSiteKey: null,
			recaptchaSecretKey: null,
			enableTurnstile: true,
			turnstileSiteKey: 'ts-site',
			turnstileSecretKey: 'ts-secret',
			proxyAccountId: 'proxyid',
			maintainerName: 'Admin',
			maintainerEmail: 'admin@example.com',
			langs: ['ja', 'en'],
			summalyProxy: 'https://summaly.example.com',
			enableEmail: true,
			email: 'noreply@example.com',
			smtpSecure: true,
			smtpHost: 'smtp.example.com',
			smtpPort: 587,
			smtpUser: 'user',
			smtpPass: 'pass',
			swPublicKey: 'pub',
			swPrivateKey: 'priv',
			termsOfServiceUrl: 'https://example.com/tos',
			repositoryUrl: 'https://example.com/repo',
			feedbackUrl: 'https://example.com/feedback',
			useObjectStorage: true,
			objectStorageBaseUrl: 'https://obj.example.com',
			objectStorageBucket: 'bucket',
			objectStoragePrefix: 'prefix',
			objectStorageEndpoint: 's3.example.com',
			objectStorageRegion: 'ap-northeast-1',
			objectStoragePort: 9000,
			objectStorageAccessKey: 'access',
			objectStorageSecretKey: 'secret2',
			objectStorageUseSSL: true,
			objectStorageUseProxy: true,
			objectStorageSetPublicRead: true,
			objectStorageS3ForcePathStyle: true,
			deeplAuthKey: 'deepl-key',
			deeplIsPro: true,
			enableIpLogging: true,
			enableActiveEmailValidation: true,
			enableChartsForRemoteUser: true,
			enableChartsForFederatedInstances: true,
			serverRules: ['be nice'],
			preservedUsernames: ['admin'],
		});
		expect(moderationLogService.insertModerationLog).toHaveBeenCalledWith(me, 'updateMeta');
	});

	test('filters out falsy values from array fields', async () => {
		const { endpoint, metaService } = createEndpoint({});

		await endpoint.exec({
			pinnedUsers: ['alice', '', 'bob'],
			hiddenTags: ['', 'nsfw'],
			blockedHosts: ['EXAMPLE.COM', ''],
			sensitiveWords: ['bad', ''],
			langs: ['ja', '', 'en'],
		}, createLocalUser(), null);

		expect(metaService.update).toHaveBeenCalledWith(expect.objectContaining({
			pinnedUsers: ['alice', 'bob'],
			hiddenTags: ['nsfw'],
			blockedHosts: ['example.com'],
			sensitiveWords: ['bad'],
			langs: ['ja', 'en'],
		}));
	});

	test('sets deeplAuthKey to null when empty string is provided', async () => {
		const { endpoint, metaService } = createEndpoint({});

		await endpoint.exec({ deeplAuthKey: '' }, createLocalUser(), null);

		expect(metaService.update).toHaveBeenCalledWith(expect.objectContaining({
			deeplAuthKey: null,
		}));
	});

	test('does not update fields that are not provided', async () => {
		const { endpoint, metaService } = createEndpoint({});

		await endpoint.exec({ name: 'Only Name' }, createLocalUser(), null);

		expect(metaService.update).toHaveBeenCalledWith({ name: 'Only Name' });
	});

	test('rejects invalid themeColor format', async () => {
		const { endpoint } = createEndpoint({});

		await expect(endpoint.exec({ themeColor: '#fff' }, createLocalUser(), null))
			.rejects.toMatchObject({ code: 'INVALID_PARAM' });
	});

	test('rejects invalid proxyAccountId format', async () => {
		const { endpoint } = createEndpoint({});

		await expect(endpoint.exec({ proxyAccountId: 'invalid id!' }, createLocalUser(), null))
			.rejects.toMatchObject({ code: 'INVALID_PARAM' });
	});
});
