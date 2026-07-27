process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { AccountUpdateService } from '@/core/AccountUpdateService.js';
import type { Config } from '@/config.js';
import type { UsersRepository } from '@/models/index.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import type { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import type { User } from '@/models/entities/User.js';

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const usersRepository = {
		findOneBy: jest.fn().mockResolvedValue({ id: 'user1', host: null } as User),
	} as unknown as jest.Mocked<UsersRepository>;

	const userEntityService = {
		isLocalUser: jest.fn().mockReturnValue(true),
	} as unknown as UserEntityService;

	const apRendererService = {
		renderPerson: jest.fn().mockResolvedValue({ type: 'Person' }),
		renderUpdate: jest.fn().mockReturnValue({ type: 'Update' }),
		addContext: jest.fn().mockImplementation(x => x),
	} as unknown as ApRendererService;

	const apDeliverManagerService = {
		deliverToFollowers: jest.fn(),
	} as unknown as ApDeliverManagerService;

	const service = new AccountUpdateService(
		config,
		usersRepository,
		userEntityService,
		apRendererService,
		apDeliverManagerService,
	);

	return {
		service,
		mocks: {
			usersRepository,
			userEntityService,
			apRendererService,
			apDeliverManagerService,
		},
	};
}

describe('AccountUpdateService', () => {
	test('publishToFollowers delivers update for local user', async () => {
		const { service, mocks } = createService();

		await service.publishToFollowers('user1');

		expect(mocks.apRendererService.renderPerson).toHaveBeenCalled();
		expect(mocks.apDeliverManagerService.deliverToFollowers).toHaveBeenCalled();
	});

	test('publishToFollowers skips remote user', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.isLocalUser.mockReturnValue(false);

		await service.publishToFollowers('user1');

		expect(mocks.apDeliverManagerService.deliverToFollowers).not.toHaveBeenCalled();
	});

	test('publishToFollowers throws when user not found', async () => {
		const { service, mocks } = createService();
		mocks.usersRepository.findOneBy.mockResolvedValue(null);

		await expect(service.publishToFollowers('user1')).rejects.toThrow('user not found');
	});
});
