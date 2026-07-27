process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { SignupService } from '@/core/SignupService.js';
import type { Config } from '@/config.js';
import type { UsedUsernamesRepository, UsersRepository } from '@/models/index.js';
import type { DataSource } from 'typeorm';
import type { IdService } from '@/core/IdService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { UtilityService } from '@/core/UtilityService.js';
import type { MetaService } from '@/core/MetaService.js';
import type UsersChart from '@/core/chart/charts/users.js';
import { User } from '@/models/entities/User.js';
import { UserProfile } from '@/models/entities/UserProfile.js';
import { UserKeypair } from '@/models/entities/UserKeypair.js';
import { UsedUsername } from '@/models/entities/UsedUsername.js';

const generateKeyPairMock = jest.fn();

jest.unstable_mockModule('node:crypto', () => ({
	generateKeyPair: generateKeyPairMock,
}));

function createService() {
	const config = {} as unknown as Config;

	const transactionalEntityManager = {
		findOneBy: jest.fn().mockResolvedValue(null),
		save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
	};

	const db = {
		transaction: jest.fn().mockImplementation(async (cb: any) => cb(transactionalEntityManager)),
	} as unknown as DataSource;

	const usersRepository = {
		exist: jest.fn().mockResolvedValue(false),
		countBy: jest.fn().mockResolvedValue(1),
	} as unknown as jest.Mocked<UsersRepository>;

	const usedUsernamesRepository = {
		exist: jest.fn().mockResolvedValue(false),
	} as unknown as jest.Mocked<UsedUsernamesRepository>;

	const utilityService = {
		toPunyNullable: jest.fn().mockImplementation(host => host),
	} as unknown as UtilityService;

	const userEntityService = {
		validateLocalUsername: jest.fn().mockReturnValue(true),
		validatePassword: jest.fn().mockReturnValue(true),
	} as unknown as UserEntityService;

	const idService = {
		genId: jest.fn().mockReturnValue('user1'),
	} as unknown as IdService;

	const metaService = {
		fetch: jest.fn().mockResolvedValue({ preservedUsernames: [] }),
	} as unknown as MetaService;

	const usersChart = {
		update: jest.fn(),
	} as unknown as UsersChart;

	const service = new SignupService(
		db,
		config,
		usersRepository,
		usedUsernamesRepository,
		utilityService,
		userEntityService,
		idService,
		metaService,
		usersChart,
	);

	return {
		service,
		mocks: {
			db,
			transactionalEntityManager,
			usersRepository,
			usedUsernamesRepository,
			utilityService,
			userEntityService,
			idService,
			metaService,
			usersChart,
		},
	};
}

describe('SignupService', () => {
	beforeEach(() => {
		generateKeyPairMock.mockReset();
		generateKeyPairMock.mockImplementation((_: any, _opts: any, cb: any) => cb(null, 'public-key', 'private-key'));
	});

	test('signup creates account with generated password hash', async () => {
		const { service, mocks } = createService();

		const result = await service.signup({ username: 'alice', password: 'pass' });

		expect(result.account).toBeInstanceOf(User);
		expect(result.secret).toBeDefined();
		expect(mocks.transactionalEntityManager.save).toHaveBeenCalledTimes(4);
		expect(mocks.usersChart.update).toHaveBeenCalled();
	});

	test('signup uses provided password hash', async () => {
		const { service, mocks } = createService();

		await service.signup({ username: 'alice', passwordHash: 'existinghash' });

		const savedProfile = mocks.transactionalEntityManager.save.mock.calls.find(([entity]: [any]) => entity instanceof UserProfile)?.[0];
		expect(savedProfile.password).toBe('existinghash');
	});

	test('signup throws on invalid username', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.validateLocalUsername.mockReturnValue(false);

		await expect(service.signup({ username: 'bad' })).rejects.toThrow('INVALID_USERNAME');
	});

	test('signup throws on invalid password', async () => {
		const { service, mocks } = createService();
		mocks.userEntityService.validatePassword.mockReturnValue(false);

		await expect(service.signup({ username: 'alice', password: 'pass' })).rejects.toThrow('INVALID_PASSWORD');
	});

	test('signup throws on duplicate username', async () => {
		const { service, mocks } = createService();
		mocks.usersRepository.exist.mockResolvedValue(true);

		await expect(service.signup({ username: 'alice', password: 'pass' })).rejects.toThrow('DUPLICATED_USERNAME');
	});

	test('signup throws on used username', async () => {
		const { service, mocks } = createService();
		mocks.usedUsernamesRepository.exist.mockResolvedValue(true);

		await expect(service.signup({ username: 'alice', password: 'pass' })).rejects.toThrow('USED_USERNAME');
	});

	test('signup throws on preserved username for non-first user', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({ preservedUsernames: ['Admin'] });

		await expect(service.signup({ username: 'admin', password: 'pass' })).rejects.toThrow('USED_USERNAME');
	});

	test('signup allows preserved username for first user', async () => {
		const { service, mocks } = createService();
		mocks.usersRepository.countBy.mockResolvedValue(0);
		mocks.metaService.fetch.mockResolvedValue({ preservedUsernames: ['admin'] });

		const result = await service.signup({ username: 'admin', password: 'pass' });

		expect(result.account.isRoot).toBe(true);
	});

	test('signup sets host via utilityService', async () => {
		const { service, mocks } = createService();
		mocks.utilityService.toPunyNullable.mockReturnValue('remote.example');

		const result = await service.signup({ username: 'alice', password: 'pass', host: 'Remote.Example' });

		expect(mocks.utilityService.toPunyNullable).toHaveBeenCalledWith('Remote.Example');
		expect(result.account.host).toBe('remote.example');
	});

	test('signup throws when transaction finds existing user', async () => {
		const { service, mocks } = createService();
		mocks.transactionalEntityManager.findOneBy.mockResolvedValue({ id: 'existing' });

		await expect(service.signup({ username: 'alice', password: 'pass' })).rejects.toThrow('already used');
	});

	test('signup ignores preserved username when flag set', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({ preservedUsernames: ['admin'] });

		const result = await service.signup({ username: 'admin', password: 'pass', ignorePreservedUsernames: true });

		expect(result.account.username).toBe('admin');
	});
});
