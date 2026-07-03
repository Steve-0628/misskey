
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { HashtagService } from '../../src/core/HashtagService.js';
import { DI } from '../../src/di-symbols.js';
import { HashtagsRepository, UsersRepository } from '../../src/models/index.js';
import { UserEntityService } from '../../src/core/entities/UserEntityService.js';
import { IdService } from '../../src/core/IdService.js';

// Mock dependencies
const mockUsersRepository = {
	findOneBy: jest.fn(),
} as unknown as UsersRepository;

const mockHashtagsRepository = {
	findOneBy: jest.fn(),
	createQueryBuilder: jest.fn(),
	insert: jest.fn(),
} as unknown as HashtagsRepository;

const mockUserEntityService = {
	isLocalUser: jest.fn(),
	isRemoteUser: jest.fn(),
} as unknown as UserEntityService;

const mockIdService = {
	genId: jest.fn(),
} as unknown as IdService;

// Mock SelectQueryBuilder
const mockQueryBuilder = {
	update: jest.fn(),
	set: jest.fn(),
	where: jest.fn(),
	execute: jest.fn(),
};

describe('HashtagService', () => {
	let hashtagService: HashtagService;

	beforeEach(() => {
		jest.clearAllMocks();
		(mockQueryBuilder.update as jest.Mock).mockReturnValue(mockQueryBuilder);
		(mockQueryBuilder.set as jest.Mock).mockReturnValue(mockQueryBuilder);
		(mockQueryBuilder.where as jest.Mock).mockReturnValue(mockQueryBuilder);

		(mockHashtagsRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
		hashtagService = new HashtagService(
			mockUsersRepository,
			mockHashtagsRepository,
			mockUserEntityService,
			mockIdService,
		);
	});

	test('updateHashtag: should insert new hashtag if not exists', async () => {
		const user = { id: 'u1', host: null } as any;
		const tag = 'test';
		(mockHashtagsRepository.findOneBy as jest.Mock).mockResolvedValue(null);
		(mockUserEntityService.isLocalUser as jest.Mock).mockReturnValue(true);
		(mockUserEntityService.isRemoteUser as jest.Mock).mockReturnValue(false);
		(mockIdService.genId as jest.Mock).mockReturnValue('h1');

		await hashtagService.updateHashtag(user, tag, true, true);

		expect(mockHashtagsRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
			name: 'test',
			attachedUserIds: ['u1'],
		}));
	});

	test('updateHashtag: should update existing hashtag', async () => {
		const user = { id: 'u1', host: null } as any;
		const tag = 'test';
		const existingTag = {
			id: 'h1',
			name: 'test',
			attachedUserIds: [],
			attachedLocalUserIds: [],
			attachedRemoteUserIds: [],
			mentionedUserIds: [],
			mentionedLocalUserIds: [],
			mentionedRemoteUserIds: [],
		};

		(mockHashtagsRepository.findOneBy as jest.Mock).mockResolvedValue(existingTag);
		(mockUserEntityService.isLocalUser as jest.Mock).mockReturnValue(true);

		await hashtagService.updateHashtag(user, tag, true, true);

		expect(mockQueryBuilder.update).toHaveBeenCalled();
		expect(mockQueryBuilder.set).toHaveBeenCalled();
		expect(mockQueryBuilder.execute).toHaveBeenCalled();
	});
});
