process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import HashtagsTrendEndpoint from '@/server/api/endpoints/hashtags/trend.js';
import type { NotesRepository } from '../../../../../src/models/index.js';
import type { MetaService } from '../../../../../src/core/MetaService.js';
import type { Note } from '../../../../../src/models/entities/Note.js';
import type { Meta } from '../../../../../src/models/entities/Meta.js';
import type { SelectQueryBuilder } from 'typeorm';

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

function createNote(partial: Partial<Note> = {}): Note {
	return {
		id: 'note1',
		createdAt: new Date(),
		replyId: null,
		reply: null,
		renoteId: null,
		renote: null,
		text: null,
		cw: null,
		userId: 'user1',
		user: null as unknown as Note['user'],
		replyUserId: null,
		replyUser: null,
		renoteUserId: null,
		renoteUser: null,
		fileIds: [],
		files: [],
		visibleUserIds: [],
		visibleUsers: [],
		reactions: {},
		reactionAndUserPairCache: [],
		emojis: [],
		mentions: [],
		mentionedRemoteUsers: [],
		urls: [],
		tags: [],
		hasPoll: false,
		localOnly: false,
		reactionAcceptance: null,
		...partial,
	} as unknown as Note;
}

type QueryBuilderMock = jest.Mocked<Pick<SelectQueryBuilder<Note>, 'where' | 'andWhere' | 'select' | 'cache' | 'getMany' | 'getRawOne'>>;

function createNotesRepository(trendData: {
	notes: Note[];
	chartCounts: number[][];
	totalCounts: number[];
}): NotesRepository {
	const { notes, chartCounts, totalCounts } = trendData;
	let rawCallIndex = -1;

	const createQueryBuilder = jest.fn().mockImplementation(() => {
		const builder: QueryBuilderMock = {
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			select: jest.fn().mockReturnThis(),
			cache: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue(notes),
			getRawOne: jest.fn().mockImplementation(() => {
				rawCallIndex++;
				if (rawCallIndex < chartCounts.flat().length) {
					return Promise.resolve({ count: String(chartCounts.flat()[rawCallIndex]) });
				}
				const totalIndex = rawCallIndex - chartCounts.flat().length;
				return Promise.resolve({ count: String(totalCounts[totalIndex] ?? 0) });
			}),
		};

		return builder as unknown as SelectQueryBuilder<Note>;
	});

	return {
		createQueryBuilder,
	} as unknown as NotesRepository;
}

function createEndpoint(trendData: {
	notes: Note[];
	chartCounts: number[][];
	totalCounts: number[];
	hiddenTags?: string[];
}) {
	const meta = createMeta({ hiddenTags: trendData.hiddenTags ?? [] });
	const metaService = {
		fetch: jest.fn().mockResolvedValue(meta),
	} as unknown as MetaService;

	const notesRepository = createNotesRepository({
		notes: trendData.notes,
		chartCounts: trendData.chartCounts,
		totalCounts: trendData.totalCounts,
	});

	const endpoint = new HashtagsTrendEndpoint(notesRepository, metaService);
	return { endpoint, metaService, notesRepository };
}

describe('api:hashtags/trend', () => {
	test('returns empty array when no tagged notes exist', async () => {
		const { endpoint, notesRepository } = createEndpoint({
			notes: [],
			chartCounts: [],
			totalCounts: [],
		});

		const res = await endpoint.exec({}, null, null);

		expect(notesRepository.createQueryBuilder).toHaveBeenCalledWith('note');
		expect(res).toEqual([]);
	});

	test('returns trending hashtags sorted by unique user count', async () => {
		const notes = [
			createNote({ id: 'n1', userId: 'u1', tags: ['misskey'] }),
			createNote({ id: 'n2', userId: 'u2', tags: ['misskey'] }),
			createNote({ id: 'n3', userId: 'u3', tags: ['misskey'] }),
			createNote({ id: 'n4', userId: 'u1', tags: ['fediverse'] }),
			createNote({ id: 'n5', userId: 'u2', tags: ['fediverse'] }),
			createNote({ id: 'n6', userId: 'u4', tags: ['javascript'] }),
		];

		const chartCounts: number[][] = Array.from({ length: 20 }, () => [0, 0, 0]);
		const totalCounts = [3, 2, 1];

		const { endpoint } = createEndpoint({ notes, chartCounts, totalCounts });

		const res = await endpoint.exec({}, null, null);

		expect(res).toHaveLength(3);
		expect(res[0]).toEqual(expect.objectContaining({ tag: 'misskey', usersCount: 3 }));
		expect(res[1]).toEqual(expect.objectContaining({ tag: 'fediverse', usersCount: 2 }));
		expect(res[2]).toEqual(expect.objectContaining({ tag: 'javascript', usersCount: 1 }));
		expect(res[0].chart).toHaveLength(20);
	});

	test('excludes hidden tags configured in instance meta', async () => {
		const notes = [
			createNote({ id: 'n1', userId: 'u1', tags: ['misskey'] }),
			createNote({ id: 'n2', userId: 'u2', tags: ['hiddentag'] }),
		];

		const chartCounts: number[][] = Array.from({ length: 20 }, () => [0]);
		const totalCounts = [1];

		const { endpoint } = createEndpoint({
			notes,
			chartCounts,
			totalCounts,
			hiddenTags: ['HiddenTag'],
		});

		const res = await endpoint.exec({}, null, null);

		expect(res).toHaveLength(1);
		expect(res[0]).toEqual(expect.objectContaining({ tag: 'misskey' }));
	});

	test('deduplicates users within the same tag', async () => {
		const notes = [
			createNote({ id: 'n1', userId: 'u1', tags: ['misskey'] }),
			createNote({ id: 'n2', userId: 'u1', tags: ['misskey'] }),
			createNote({ id: 'n3', userId: 'u1', tags: ['misskey'] }),
		];

		const chartCounts: number[][] = Array.from({ length: 20 }, () => [0]);
		const totalCounts = [1];

		const { endpoint } = createEndpoint({ notes, chartCounts, totalCounts });

		const res = await endpoint.exec({}, null, null);

		expect(res[0]).toEqual(expect.objectContaining({ tag: 'misskey', usersCount: 1 }));
	});

	test('limits results to top 5 hashtags', async () => {
		const notes = Array.from({ length: 10 }, (_, i) =>
			createNote({ id: `n${i}`, userId: `u${i}`, tags: [`tag${i}`] }),
		);

		const chartCounts: number[][] = Array.from({ length: 20 }, () => Array.from({ length: 10 }, () => 0));
		const totalCounts = Array.from({ length: 10 }, () => 1);

		const { endpoint } = createEndpoint({ notes, chartCounts, totalCounts });

		const res = await endpoint.exec({}, null, null);

		expect(res).toHaveLength(5);
	});

	test('includes multiple tags from a single note', async () => {
		const notes = [
			createNote({ id: 'n1', userId: 'u1', tags: ['misskey', 'fediverse'] }),
		];

		const chartCounts: number[][] = Array.from({ length: 20 }, () => [0, 0]);
		const totalCounts = [1, 1];

		const { endpoint } = createEndpoint({ notes, chartCounts, totalCounts });

		const res = await endpoint.exec({}, null, null);

		expect(res).toHaveLength(2);
		expect(res.map(r => r.tag)).toContain('misskey');
		expect(res.map(r => r.tag)).toContain('fediverse');
	});
});
