process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { Test } from '@nestjs/testing';
import { describe, test, beforeAll, afterAll } from '@jest/globals';
import { GlobalModule } from '@/GlobalModule.js';
import { EndpointsModule } from '@/server/api/EndpointsModule.js';
import { SignupService } from '@/core/SignupService.js';
import { DI } from '@/di-symbols.js';
import type { UserMemoRepository } from '@/models/index.js';
import type { User } from '@/models/entities/User.js';

type Exec = {
	exec: (params: any, user: any, token: any) => Promise<any>;
};

describe('endpoints: users/show, users/update-memo', () => {
	let app: any;
	let usersShow: Exec;
	let updateMemo: Exec;
	let userMemosRepository: UserMemoRepository;

	let alice: User;
	let bob: User;

	beforeAll(async () => {
		app = await Test.createTestingModule({
			imports: [GlobalModule, EndpointsModule],
		}).compile();
		await app.init();
		usersShow = app.get('ep:users/show');
		updateMemo = app.get('ep:users/update-memo');
		userMemosRepository = app.get(DI.userMemosRepository);

		const signupService = app.get(SignupService);
		alice = (await signupService.signup({ username: 'alice', password: 'alice1234' })).account;
		bob = (await signupService.signup({ username: 'bob', password: 'bob12345' })).account;
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await app.close();
	});

	describe('users/show', () => {
		test('shows a user by id', async () => {
			const res = await usersShow.exec({ userId: alice.id }, bob, null);
			assert.strictEqual(res.id, alice.id);
			assert.strictEqual(res.username, 'alice');
		});

		test('shows a user by username', async () => {
			const res = await usersShow.exec({ username: 'alice' }, bob, null);
			assert.strictEqual(res.id, alice.id);
		});

		test('rejects a non-existent user', async () => {
			await assert.rejects(
				usersShow.exec({ userId: '000000000000' }, bob, null),
				(err: any) => err.code === 'NO_SUCH_USER',
			);
		});

		test('rejects a non-existent username', async () => {
			await assert.rejects(
				usersShow.exec({ username: 'nobody' }, bob, null),
				(err: any) => err.code === 'NO_SUCH_USER',
			);
		});

		test('rejects when neither userId nor username is given', async () => {
			await assert.rejects(
				usersShow.exec({}, bob, null),
				(err: any) => err.code === 'INVALID_PARAM',
			);
		});
	});

	describe('users/update-memo', () => {
		test('sets a memo on another user', async () => {
			await updateMemo.exec({ userId: bob.id, memo: 'my memo' }, alice, null);
			const memo = await userMemosRepository.findOneByOrFail({ userId: alice.id, targetUserId: bob.id });
			assert.strictEqual(memo.memo, 'my memo');
		});

		test('clearing the memo removes it', async () => {
			await updateMemo.exec({ userId: bob.id, memo: 'first' }, alice, null);
			await updateMemo.exec({ userId: bob.id, memo: '' }, alice, null);
			const memo = await userMemosRepository.findOneBy({ userId: alice.id, targetUserId: bob.id });
			assert.strictEqual(memo, null);
		});

		test('accepts a memo of the maximum length', async () => {
			await updateMemo.exec({ userId: bob.id, memo: 'x'.repeat(2048) }, alice, null);
			const memo = await userMemosRepository.findOneByOrFail({ userId: alice.id, targetUserId: bob.id });
			assert.strictEqual(memo.memo.length, 2048);
		});

		test('rejects a memo that is too long', async () => {
			await assert.rejects(
				updateMemo.exec({ userId: bob.id, memo: 'x'.repeat(2049) }, alice, null),
				(err: any) => err.code === 'INVALID_PARAM',
			);
		});

		test('rejects a non-existent user', async () => {
			await assert.rejects(
				updateMemo.exec({ userId: '000000000000', memo: 'x' }, alice, null),
				(err: any) => err.code === 'NO_SUCH_USER',
			);
		});
	});
});
