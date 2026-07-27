process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import { SigninApiService } from '@/server/api/SigninApiService.js';
import type { Config } from '@/config.js';
import type { UsersRepository, UserSecurityKeysRepository, UserProfilesRepository, AttestationChallengesRepository, SigninsRepository } from '@/models/index.js';
import type { IdService } from '@/core/IdService.js';
import type { TwoFactorAuthenticationService } from '@/core/TwoFactorAuthenticationService.js';
import type { RateLimiterService } from '@/server/api/RateLimiterService.js';
import type { SigninService } from '@/server/api/SigninService.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { LocalUser } from '@/models/entities/User.js';

function createRequest(body: any = {}): FastifyRequest<any> {
	return {
		body,
		ip: '127.0.0.1',
		headers: {},
	} as unknown as FastifyRequest<any>;
}

function createReply(): FastifyReply {
	return {
		code: jest.fn().mockReturnThis(),
		header: jest.fn().mockReturnThis(),
	} as unknown as FastifyReply;
}

function createUser(data: Partial<LocalUser> = {}): LocalUser {
	return {
		id: 'user1',
		usernameLower: 'alice',
		host: null,
		isSuspended: false,
		...data,
	} as unknown as LocalUser;
}

function createProfile(data: any = {}) {
	return {
		userId: 'user1',
		password: 'hashed',
		twoFactorEnabled: false,
		twoFactorSecret: null,
		usePasswordLessLogin: false,
		...data,
	};
}

async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 1);
}

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const usersRepository = {
		findOneBy: jest.fn().mockResolvedValue(createUser()),
	} as unknown as jest.Mocked<UsersRepository>;

	const userProfilesRepository = {
		findOneByOrFail: jest.fn().mockResolvedValue(createProfile()),
	} as unknown as jest.Mocked<UserProfilesRepository>;

	const signinsRepository = {
		insert: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<SigninsRepository>;

	const userSecurityKeysRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
		findBy: jest.fn().mockResolvedValue([]),
	} as unknown as jest.Mocked<UserSecurityKeysRepository>;

	const attestationChallengesRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
		insert: jest.fn().mockResolvedValue(undefined),
		delete: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<AttestationChallengesRepository>;

	const idService = {
		genId: jest.fn().mockReturnValue('id1'),
	} as unknown as IdService;

	const rateLimiterService = {
		limit: jest.fn().mockResolvedValue(undefined),
	} as unknown as RateLimiterService;

	const signinService = {
		signin: jest.fn().mockResolvedValue({ success: true }),
	} as unknown as SigninService;

	const twoFactorAuthenticationService = {
		hash: jest.fn().mockReturnValue(Buffer.from('hash')),
		verifySignin: jest.fn().mockReturnValue(true),
	} as unknown as TwoFactorAuthenticationService;

	const service = new SigninApiService(
		config,
		usersRepository,
		userSecurityKeysRepository,
		userProfilesRepository,
		attestationChallengesRepository,
		signinsRepository,
		idService,
		rateLimiterService,
		signinService,
		twoFactorAuthenticationService,
	);

	return {
		service,
		mocks: {
			usersRepository,
			userProfilesRepository,
			signinsRepository,
			userSecurityKeysRepository,
			attestationChallengesRepository,
			idService,
			rateLimiterService,
			signinService,
			twoFactorAuthenticationService,
		},
	};
}

describe('SigninApiService', () => {
	test('returns 400 when username is not string', async () => {
		const { service } = createService();
		const reply = createReply();

		await service.signin(createRequest({ username: 123, password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('returns 404 when user not found', async () => {
		const { service, mocks } = createService();
		mocks.usersRepository.findOneBy.mockResolvedValue(null);
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(404);
		expect(result).toEqual({ error: { id: '6cc579cc-885d-43d8-95c2-b8c7fc963280' } });
	});

	test('returns 403 when user is suspended', async () => {
		const { service, mocks } = createService();
		mocks.usersRepository.findOneBy.mockResolvedValue(createUser({ isSuspended: true }));
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(403);
		expect(result).toEqual({ error: { id: 'e03a5f46-d309-4865-9b69-56282d94e1eb' } });
	});

	test('signs in without 2fa when password matches', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ password: await hashPassword('pass') }));
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(mocks.signinService.signin).toHaveBeenCalled();
		expect(result).toEqual({ success: true });
	});

	test('returns 403 when password does not match', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ password: await hashPassword('other') }));
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(403);
		expect(mocks.signinsRepository.insert).toHaveBeenCalled();
		expect(result).toEqual({ error: { id: '932c904e-9460-45b7-9ce6-7ed33be7eb2c' } });
	});

	test('signs in with valid 2fa token', async () => {
		const { service, mocks } = createService();
		const secret = new OTPAuth.Secret({ size: 20 });
		const totp = new OTPAuth.TOTP({ secret, digits: 6 });
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({
			twoFactorEnabled: true,
			twoFactorSecret: secret.base32,
			password: await hashPassword('pass'),
		}));
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass', token: totp.generate() }), reply);

		expect(mocks.signinService.signin).toHaveBeenCalled();
		expect(result).toEqual({ success: true });
	});

	test('returns 403 with invalid 2fa token', async () => {
		const { service, mocks } = createService();
		const secret = new OTPAuth.Secret({ size: 20 });
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({
			twoFactorEnabled: true,
			twoFactorSecret: secret.base32,
			password: await hashPassword('pass'),
		}));
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass', token: '000000' }), reply);

		expect(reply.code).toHaveBeenCalledWith(403);
		expect(result).toEqual({ error: { id: 'cdf1235b-ac71-46d4-a3a6-84ccce48df6f' } });
	});

	test('returns challenge when passwordless with security keys', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({
			twoFactorEnabled: true,
			usePasswordLessLogin: true,
			twoFactorSecret: 'secret',
			password: await hashPassword('pass'),
		}));
		mocks.userSecurityKeysRepository.findBy.mockResolvedValue([{ id: 'key1', publicKey: 'pub' }] as any);
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'wrong' }), reply);

		expect(reply.code).toHaveBeenCalledWith(200);
		expect(result).toHaveProperty('challenge');
		expect(result).toHaveProperty('securityKeys');
	});

	test('returns 429 when rate limiter throws', async () => {
		const { service, mocks } = createService();
		mocks.rateLimiterService.limit.mockRejectedValue(new Error('rate limited'));
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(429);
		expect(result).toHaveProperty('error');
	});

	test('returns 400 when password is not string', async () => {
		const { service } = createService();
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 123 }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('returns 400 when token is not string', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret' }));
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass', token: 123 }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('2fa enabled: wrong password without passwordless returns 403', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret', password: await hashPassword('other') }));
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(403);
	});

	test('2fa enabled: correct password but no keys returns 403', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret', password: await hashPassword('pass') }));
		mocks.userSecurityKeysRepository.findBy.mockResolvedValue([]);
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(403);
		expect(result).toEqual({ error: { id: 'f27fd449-9af4-4841-9249-1f989b9fa4a4' } });
	});

	test('2fa security key: missing challenge returns 403', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret', password: await hashPassword('pass') }));
		mocks.attestationChallengesRepository.findOneBy.mockResolvedValue(null);
		const reply = createReply();

		const result = await service.signin(createRequest({
			username: 'alice',
			password: 'pass',
			credentialId: 'aaaa',
			clientDataJSON: '7b7d',
			authenticatorData: 'aaaa',
			signature: 'aaaa',
			challengeId: 'challenge1',
		}), reply);

		expect(reply.code).toHaveBeenCalledWith(403);
		expect(result).toEqual({ error: { id: '2715a88a-2125-4013-932f-aa6fe72792da' } });
	});

	test('2fa security key: expired challenge returns 403', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret', password: await hashPassword('pass') }));
		mocks.attestationChallengesRepository.findOneBy.mockResolvedValue({ id: 'challenge1', createdAt: new Date(Date.now() - 6 * 60 * 1000), challenge: 'hash' } as any);
		const reply = createReply();

		const result = await service.signin(createRequest({
			username: 'alice',
			password: 'pass',
			credentialId: 'aaaa',
			clientDataJSON: '7b7d',
			authenticatorData: 'aaaa',
			signature: 'aaaa',
			challengeId: 'challenge1',
		}), reply);

		expect(reply.code).toHaveBeenCalledWith(403);
	});

	test('2fa security key: unknown key returns 403', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret', password: await hashPassword('pass') }));
		mocks.attestationChallengesRepository.findOneBy.mockResolvedValue({ id: 'challenge1', createdAt: new Date(), challenge: 'hash' } as any);
		mocks.userSecurityKeysRepository.findOneBy.mockResolvedValue(null);
		const reply = createReply();

		const result = await service.signin(createRequest({
			username: 'alice',
			password: 'pass',
			credentialId: 'aaaa',
			clientDataJSON: '7b7d',
			authenticatorData: 'aaaa',
			signature: 'aaaa',
			challengeId: 'challenge1',
		}), reply);

		expect(reply.code).toHaveBeenCalledWith(403);
		expect(result).toEqual({ error: { id: '66269679-aeaf-4474-862b-eb761197e046' } });
	});

	test('2fa security key: invalid signature returns 403', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret', password: await hashPassword('pass') }));
		mocks.attestationChallengesRepository.findOneBy.mockResolvedValue({ id: 'challenge1', createdAt: new Date(), challenge: 'hash' } as any);
		mocks.userSecurityKeysRepository.findOneBy.mockResolvedValue({ id: '69a0', publicKey: 'pubkey' } as any);
		mocks.twoFactorAuthenticationService.verifySignin.mockReturnValue(false);
		const reply = createReply();

		const result = await service.signin(createRequest({
			username: 'alice',
			password: 'pass',
			credentialId: 'aaaa',
			clientDataJSON: '7b7d',
			authenticatorData: 'aaaa',
			signature: 'aaaa',
			challengeId: 'challenge1',
		}), reply);

		expect(reply.code).toHaveBeenCalledWith(403);
		expect(result).toEqual({ error: { id: '93b86c4b-72f9-40eb-9815-798928603d1e' } });
	});

	test('2fa security key: valid signature signs in', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret', password: await hashPassword('pass') }));
		mocks.attestationChallengesRepository.findOneBy.mockResolvedValue({ id: 'challenge1', createdAt: new Date(), challenge: 'hash' } as any);
		mocks.userSecurityKeysRepository.findOneBy.mockResolvedValue({ id: '69a0', publicKey: 'pubkey' } as any);
		mocks.twoFactorAuthenticationService.verifySignin.mockReturnValue(true);
		const reply = createReply();

		const result = await service.signin(createRequest({
			username: 'alice',
			password: 'pass',
			credentialId: 'aaaa',
			clientDataJSON: '7b7d',
			authenticatorData: 'aaaa',
			signature: 'aaaa',
			challengeId: 'challenge1',
		}), reply);

		expect(mocks.signinService.signin).toHaveBeenCalled();
		expect(result).toEqual({ success: true });
	});

	test('2fa enabled: correct password with keys returns challenge', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret', password: await hashPassword('pass') }));
		mocks.userSecurityKeysRepository.findBy.mockResolvedValue([{ id: 'key1', publicKey: 'pub' }] as any);
		mocks.idService.genId.mockReturnValue('challengeId1');
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(200);
		expect(result).toHaveProperty('challenge');
		expect(result).toHaveProperty('securityKeys');
	});

	test('2fa enabled: partial credentials fall through to challenge branch', async () => {
		const { service, mocks } = createService();
		mocks.userProfilesRepository.findOneByOrFail.mockResolvedValue(createProfile({ twoFactorEnabled: true, twoFactorSecret: 'secret', password: await hashPassword('pass') }));
		mocks.userSecurityKeysRepository.findBy.mockResolvedValue([{ id: 'key1', publicKey: 'pub' }] as any);
		mocks.idService.genId.mockReturnValue('challengeId1');
		const reply = createReply();

		const result = await service.signin(createRequest({ username: 'alice', password: 'pass', credentialId: 'aaaa' }), reply);

		expect(reply.code).toHaveBeenCalledWith(200);
		expect(result).toHaveProperty('challenge');
	});
});
