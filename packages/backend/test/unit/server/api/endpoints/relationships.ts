process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { Test } from '@nestjs/testing';
import { describe, test, beforeAll, afterAll } from '@jest/globals';
import { GlobalModule } from '@/GlobalModule.js';
import { EndpointsModule } from '@/server/api/EndpointsModule.js';
import { SignupService } from '@/core/SignupService.js';
import { DI } from '@/di-symbols.js';
import type {
	FollowingsRepository, BlockingsRepository, MutingsRepository, RenoteMutingsRepository,
} from '@/models/index.js';
import type { User } from '@/models/entities/User.js';

type Exec = {
	exec: (params: any, user: any, token: any) => Promise<any>;
};

describe('endpoints: following/blocking/mute/renote-mute', () => {
	let app: any;
	let followingCreate: Exec;
	let followingDelete: Exec;
	let blockingCreate: Exec;
	let blockingDelete: Exec;
	let muteCreate: Exec;
	let muteDelete: Exec;
	let renoteMuteCreate: Exec;
	let renoteMuteDelete: Exec;
	let followingsRepository: FollowingsRepository;
	let blockingsRepository: BlockingsRepository;
	let mutingsRepository: MutingsRepository;
	let renoteMutingsRepository: RenoteMutingsRepository;
	let signupService: SignupService;

	let alice: User;
	let seq = 0;

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, EndpointsModule],
		}).compile();
		await app.init();
		followingCreate = app.get('ep:following/create');
		followingDelete = app.get('ep:following/delete');
		blockingCreate = app.get('ep:blocking/create');
		blockingDelete = app.get('ep:blocking/delete');
		muteCreate = app.get('ep:mute/create');
		muteDelete = app.get('ep:mute/delete');
		renoteMuteCreate = app.get('ep:renote-mute/create');
		renoteMuteDelete = app.get('ep:renote-mute/delete');
		followingsRepository = app.get(DI.followingsRepository);
		blockingsRepository = app.get(DI.blockingsRepository);
		mutingsRepository = app.get(DI.mutingsRepository);
		renoteMutingsRepository = app.get(DI.renoteMutingsRepository);
		signupService = app.get(SignupService);

		alice = (await signupService.signup({ username: 'alice', password: 'alice1234' })).account;
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await app.close();
	});

	// A fresh user per test keeps tests independent of each other.
	const newUser = async (): Promise<User> => {
		const username = `target${seq++}`;
		return (await signupService.signup({ username, password: `${username}1234` })).account;
	};

	describe('following/create', () => {
		test('creates a following', async () => {
			const target = await newUser();
			await followingCreate.exec({ userId: target.id }, alice, null);
			assert.strictEqual(await followingsRepository.exist({ where: { followerId: alice.id, followeeId: target.id } }), true);
		});

		test('rejects following the same user twice', async () => {
			const target = await newUser();
			await followingCreate.exec({ userId: target.id }, alice, null);
			await assert.rejects(
				followingCreate.exec({ userId: target.id }, alice, null),
				(err: any) => err.code === 'ALREADY_FOLLOWING',
			);
		});

		test('rejects following yourself', async () => {
			await assert.rejects(
				followingCreate.exec({ userId: alice.id }, alice, null),
				(err: any) => err.code === 'FOLLOWEE_IS_YOURSELF',
			);
		});

		test('rejects following a non-existent user', async () => {
			await assert.rejects(
				followingCreate.exec({ userId: '000000000000' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_USER',
			);
		});

		test('rejects following a user you are blocking', async () => {
			const target = await newUser();
			await blockingCreate.exec({ userId: target.id }, alice, null);
			await assert.rejects(
				followingCreate.exec({ userId: target.id }, alice, null),
				(err: any) => err.code === 'BLOCKING',
			);
		});

		test('rejects following a user who blocks you', async () => {
			const target = await newUser();
			await blockingCreate.exec({ userId: alice.id }, target, null);
			await assert.rejects(
				followingCreate.exec({ userId: target.id }, alice, null),
				(err: any) => err.code === 'BLOCKED',
			);
		});
	});

	describe('following/delete', () => {
		test('removes a following', async () => {
			const target = await newUser();
			await followingCreate.exec({ userId: target.id }, alice, null);
			await followingDelete.exec({ userId: target.id }, alice, null);
			assert.strictEqual(await followingsRepository.exist({ where: { followerId: alice.id, followeeId: target.id } }), false);
		});

		test('rejects unfollowing a user you do not follow', async () => {
			const target = await newUser();
			await assert.rejects(
				followingDelete.exec({ userId: target.id }, alice, null),
				(err: any) => err.code === 'NOT_FOLLOWING',
			);
		});

		test('rejects unfollowing yourself', async () => {
			await assert.rejects(
				followingDelete.exec({ userId: alice.id }, alice, null),
				(err: any) => err.code === 'FOLLOWEE_IS_YOURSELF',
			);
		});
	});

	describe('blocking/create', () => {
		test('creates a blocking and removes existing followings', async () => {
			const target = await newUser();
			await followingCreate.exec({ userId: target.id }, alice, null);
			await followingCreate.exec({ userId: alice.id }, target, null);

			await blockingCreate.exec({ userId: target.id }, alice, null);
			assert.strictEqual(await blockingsRepository.exist({ where: { blockerId: alice.id, blockeeId: target.id } }), true);
			assert.strictEqual(await followingsRepository.exist({ where: { followerId: alice.id, followeeId: target.id } }), false);
			assert.strictEqual(await followingsRepository.exist({ where: { followerId: target.id, followeeId: alice.id } }), false);
		});

		test('rejects blocking the same user twice', async () => {
			const target = await newUser();
			await blockingCreate.exec({ userId: target.id }, alice, null);
			await assert.rejects(
				blockingCreate.exec({ userId: target.id }, alice, null),
				(err: any) => err.code === 'ALREADY_BLOCKING',
			);
		});

		test('rejects blocking yourself', async () => {
			await assert.rejects(
				blockingCreate.exec({ userId: alice.id }, alice, null),
				(err: any) => err.code === 'BLOCKEE_IS_YOURSELF',
			);
		});
	});

	describe('blocking/delete', () => {
		test('removes a blocking', async () => {
			const target = await newUser();
			await blockingCreate.exec({ userId: target.id }, alice, null);
			await blockingDelete.exec({ userId: target.id }, alice, null);
			assert.strictEqual(await blockingsRepository.exist({ where: { blockerId: alice.id, blockeeId: target.id } }), false);
		});

		test('rejects unblocking a user you do not block', async () => {
			const target = await newUser();
			await assert.rejects(
				blockingDelete.exec({ userId: target.id }, alice, null),
				(err: any) => err.code === 'NOT_BLOCKING',
			);
		});
	});

	describe('mute/create', () => {
		test('creates a muting', async () => {
			const target = await newUser();
			await muteCreate.exec({ userId: target.id }, alice, null);
			assert.strictEqual(await mutingsRepository.exist({ where: { muterId: alice.id, muteeId: target.id } }), true);
		});

		test('rejects muting the same user twice', async () => {
			const target = await newUser();
			await muteCreate.exec({ userId: target.id }, alice, null);
			await assert.rejects(
				muteCreate.exec({ userId: target.id }, alice, null),
				(err: any) => err.code === 'ALREADY_MUTING',
			);
		});

		test('rejects muting yourself', async () => {
			await assert.rejects(
				muteCreate.exec({ userId: alice.id }, alice, null),
				(err: any) => err.code === 'MUTEE_IS_YOURSELF',
			);
		});
	});

	describe('mute/delete', () => {
		test('removes a muting', async () => {
			const target = await newUser();
			await muteCreate.exec({ userId: target.id }, alice, null);
			await muteDelete.exec({ userId: target.id }, alice, null);
			assert.strictEqual(await mutingsRepository.exist({ where: { muterId: alice.id, muteeId: target.id } }), false);
		});

		test('rejects unmuting a user you do not mute', async () => {
			const target = await newUser();
			await assert.rejects(
				muteDelete.exec({ userId: target.id }, alice, null),
				(err: any) => err.code === 'NOT_MUTING',
			);
		});
	});

	describe('renote-mute/create, renote-mute/delete', () => {
		test('creates and removes a renote-muting', async () => {
			const target = await newUser();
			await renoteMuteCreate.exec({ userId: target.id }, alice, null);
			assert.strictEqual(await renoteMutingsRepository.exist({ where: { muterId: alice.id, muteeId: target.id } }), true);

			await renoteMuteDelete.exec({ userId: target.id }, alice, null);
			assert.strictEqual(await renoteMutingsRepository.exist({ where: { muterId: alice.id, muteeId: target.id } }), false);
		});

		test('rejects renote-muting yourself', async () => {
			await assert.rejects(
				renoteMuteCreate.exec({ userId: alice.id }, alice, null),
				(err: any) => err.code === 'MUTEE_IS_YOURSELF',
			);
		});

		test('rejects removing a renote-muting that does not exist', async () => {
			const target = await newUser();
			await assert.rejects(
				renoteMuteDelete.exec({ userId: target.id }, alice, null),
				(err: any) => err.code === 'NOT_MUTING',
			);
		});
	});
});
