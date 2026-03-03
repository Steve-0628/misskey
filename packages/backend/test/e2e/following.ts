process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { signup, api, startServer } from '../utils.js';
import type { INestApplicationContext } from '@nestjs/common';
import type * as misskey from 'misskey-js';

describe('Following', () => {
	let app: INestApplicationContext;

	let alice: misskey.entities.MeSignup;
	let bob: misskey.entities.MeSignup;
	let carol: misskey.entities.MeSignup;

	beforeAll(async () => {
		app = await startServer();
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		carol = await signup({ username: 'carol' });
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await app.close();
	});

	describe('following/create', () => {
		test('can follow a user', async () => {
			const res = await api('/following/create', { userId: bob.id }, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.id, bob.id);
		});

		test('cannot follow the same user twice', async () => {
			await api('/following/create', { userId: carol.id }, alice);

			const res = await api('/following/create', { userId: carol.id }, alice);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'ALREADY_FOLLOWING');
		});

		test('cannot follow yourself', async () => {
			const res = await api('/following/create', { userId: alice.id }, alice);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'FOLLOWEE_IS_YOURSELF');
		});

		test('cannot follow a non-existent user', async () => {
			const res = await api('/following/create', {
				userId: '0000000000000000',
			}, alice);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'NO_SUCH_USER');
		});

		test('cannot follow without authentication', async () => {
			const res = await api('/following/create', { userId: bob.id });

			assert.strictEqual(res.status, 401);
		});
	});

	describe('following/delete', () => {
		test('can unfollow a user', async () => {
			await api('/following/create', { userId: bob.id }, carol);

			const res = await api('/following/delete', { userId: bob.id }, carol);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.id, bob.id);
		});

		test('cannot unfollow a user that is not being followed', async () => {
			const res = await api('/following/delete', { userId: alice.id }, carol);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'NOT_FOLLOWING');
		});

		test('cannot unfollow yourself', async () => {
			const res = await api('/following/delete', { userId: carol.id }, carol);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'FOLLOWEE_IS_YOURSELF');
		});

		test('cannot unfollow a non-existent user', async () => {
			const res = await api('/following/delete', {
				userId: '0000000000000000',
			}, alice);

			assert.strictEqual(res.status, 400);
			assert.strictEqual(res.body.error.code, 'NO_SUCH_USER');
		});
	});

	describe('users/followers and users/following', () => {
		test('following list reflects new follow', async () => {
			const follower = await signup({ username: 'followtest_follower' });
			const followee = await signup({ username: 'followtest_followee' });

			await api('/following/create', { userId: followee.id }, follower);

			const res = await api('/users/following', { userId: follower.id }, follower);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.some((f: any) => f.followeeId === followee.id), true);
		});

		test('followers list reflects new follow', async () => {
			const follower = await signup({ username: 'followtest2_follower' });
			const followee = await signup({ username: 'followtest2_followee' });

			await api('/following/create', { userId: followee.id }, follower);

			const res = await api('/users/followers', { userId: followee.id }, followee);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.some((f: any) => f.followerId === follower.id), true);
		});
	});
});
