process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { SignupApiService } from '@/server/api/SignupApiService.js';
import type { Config } from '@/config.js';
import type { RegistrationTicketsRepository, UsedUsernamesRepository, UserPendingsRepository, UserProfilesRepository, UsersRepository } from '@/models/index.js';
import type { MetaService } from '@/core/MetaService.js';
import type { CaptchaService } from '@/core/CaptchaService.js';
import type { IdService } from '@/core/IdService.js';
import type { SignupService } from '@/core/SignupService.js';
import type { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { EmailService } from '@/core/EmailService.js';
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

function createAccount(data: Partial<LocalUser> = {}): LocalUser {
	return {
		id: 'user1',
		username: 'alice',
		usernameLower: 'alice',
		host: null,
		...data,
	} as unknown as LocalUser;
}

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const usersRepository = {
		exist: jest.fn().mockResolvedValue(false),
	} as unknown as jest.Mocked<UsersRepository>;

	const userProfilesRepository = {
		findOneByOrFail: jest.fn().mockResolvedValue({ userId: 'user1' }),
		update: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<UserProfilesRepository>;

	const userPendingsRepository = {
		insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'pending1' }] }),
		findOneByOrFail: jest.fn().mockResolvedValue({
			id: 'pending1',
			code: 'code1',
			email: 'a@example.com',
			username: 'alice',
			password: 'hash',
		}),
		findOneBy: jest.fn().mockResolvedValue(null),
		delete: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<UserPendingsRepository>;

	const usedUsernamesRepository = {
		exist: jest.fn().mockResolvedValue(false),
	} as unknown as jest.Mocked<UsedUsernamesRepository>;

	const registrationTicketsRepository = {
		findOneBy: jest.fn().mockResolvedValue(null),
		update: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<RegistrationTicketsRepository>;

	const userEntityService = {
		pack: jest.fn().mockResolvedValue({ id: 'user1' }),
	} as unknown as jest.Mocked<UserEntityService>;

	const idService = {
		genId: jest.fn().mockReturnValue('id1'),
	} as unknown as IdService;

	const metaService = {
		fetch: jest.fn().mockResolvedValue({
			emailRequiredForSignup: false,
			disableRegistration: false,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		}),
	} as unknown as MetaService;

	const captchaService = {
		verifyHcaptcha: jest.fn(),
		verifyRecaptcha: jest.fn(),
		verifyTurnstile: jest.fn(),
	} as unknown as CaptchaService;

	const signupService = {
		signup: jest.fn().mockResolvedValue({ account: createAccount(), secret: 'token1' }),
	} as unknown as SignupService;

	const signinService = {
		signin: jest.fn().mockResolvedValue({ success: true }),
	} as unknown as SigninService;

	const emailService = {
		validateEmailForAccount: jest.fn().mockResolvedValue({ available: true }),
		sendEmail: jest.fn(),
	} as unknown as jest.Mocked<EmailService>;

	const service = new SignupApiService(
		config,
		usersRepository,
		userProfilesRepository,
		userPendingsRepository,
		usedUsernamesRepository,
		registrationTicketsRepository,
		userEntityService,
		idService,
		metaService,
		captchaService,
		signupService,
		signinService,
		emailService,
	);

	return {
		service,
		mocks: {
			usersRepository,
			userProfilesRepository,
			userPendingsRepository,
			usedUsernamesRepository,
			registrationTicketsRepository,
			userEntityService,
			idService,
			metaService,
			captchaService,
			signupService,
			signinService,
			emailService,
		},
	};
}

describe('SignupApiService', () => {
	test('signup creates account when registration open', async () => {
		const { service, mocks } = createService();
		const reply = createReply();

		const result = await service.signup(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(mocks.signupService.signup).toHaveBeenCalledWith({ username: 'alice', password: 'pass', host: null });
		expect(result).toHaveProperty('token', 'token1');
	});

	test('signup returns 400 when email required but missing', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: true,
			disableRegistration: false,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('signup returns 400 when email invalid', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: true,
			disableRegistration: false,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		mocks.emailService.validateEmailForAccount.mockResolvedValue({ available: false });
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass', emailAddress: 'bad' }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('signup with email required creates pending user', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: true,
			disableRegistration: false,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass', emailAddress: 'a@example.com' }), reply);

		expect(mocks.userPendingsRepository.insert).toHaveBeenCalled();
		expect(mocks.emailService.sendEmail).toHaveBeenCalled();
		expect(reply.code).toHaveBeenCalledWith(204);
	});

	test('signup with registration disabled requires valid ticket', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: false,
			disableRegistration: true,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		mocks.registrationTicketsRepository.findOneBy.mockResolvedValue({
			id: 'ticket1',
			code: 'invite',
			usedAt: null,
			expiresAt: null,
		} as any);
		const reply = createReply();

		const result = await service.signup(createRequest({ username: 'alice', password: 'pass', invitationCode: 'invite' }), reply);

		expect(mocks.registrationTicketsRepository.update).toHaveBeenCalled();
		expect(result).toHaveProperty('token', 'token1');
	});

	test('signup with registration disabled and invalid ticket returns 400', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: false,
			disableRegistration: true,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass', invitationCode: 'bad' }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('signup with expired ticket returns 400', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: false,
			disableRegistration: true,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		mocks.registrationTicketsRepository.findOneBy.mockResolvedValue({
			id: 'ticket1',
			code: 'invite',
			usedAt: null,
			expiresAt: new Date(Date.now() - 1000),
		} as any);
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass', invitationCode: 'invite' }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('signup with used ticket returns 400', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: false,
			disableRegistration: true,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		mocks.registrationTicketsRepository.findOneBy.mockResolvedValue({
			id: 'ticket1',
			code: 'invite',
			usedAt: new Date(),
			expiresAt: null,
		} as any);
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass', invitationCode: 'invite' }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('signupPending completes pending signup and signs in', async () => {
		const { service, mocks } = createService();
		mocks.userPendingsRepository.findOneByOrFail.mockResolvedValue({
			id: 'pending1',
			code: 'code1',
			email: 'a@example.com',
			username: 'alice',
			password: 'hash',
		} as any);
		const reply = createReply();

		const result = await service.signupPending(createRequest({ code: 'code1' }), reply);

		expect(mocks.signupService.signup).toHaveBeenCalledWith({ username: 'alice', passwordHash: 'hash' });
		expect(mocks.userPendingsRepository.delete).toHaveBeenCalled();
		expect(mocks.userProfilesRepository.update).toHaveBeenCalled();
		expect(result).toEqual({ success: true });
	});

	test('signup with email required returns 400 on duplicate username', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: true,
			disableRegistration: false,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		mocks.usersRepository.exist.mockResolvedValue(true);
		const reply = createReply();

		await expect(service.signup(createRequest({ username: 'alice', password: 'pass', emailAddress: 'a@example.com' }), reply)).rejects.toThrow('DUPLICATED_USERNAME');
	});

	test('signup with email required returns 400 on used username', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: true,
			disableRegistration: false,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		mocks.usedUsernamesRepository.exist.mockResolvedValue(true);
		const reply = createReply();

		await expect(service.signup(createRequest({ username: 'alice', password: 'pass', emailAddress: 'a@example.com' }), reply)).rejects.toThrow('USED_USERNAME');
	});

	test('signup with email required returns 400 on preserved username', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: true,
			disableRegistration: false,
			preservedUsernames: ['admin', 'root'],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		const reply = createReply();

		await expect(service.signup(createRequest({ username: 'admin', password: 'pass', emailAddress: 'a@example.com' }), reply)).rejects.toThrow('DENIED_USERNAME');
	});

	test('signup uses host parameter in test env', async () => {
		const { service, mocks } = createService();
		const reply = createReply();

		const result = await service.signup(createRequest({ username: 'alice', password: 'pass', host: 'remote.example' }), reply);

		expect(mocks.signupService.signup).toHaveBeenCalledWith({ username: 'alice', password: 'pass', host: 'remote.example' });
		expect(result).toHaveProperty('token', 'token1');
	});

	test('signupPending updates ticket when present', async () => {
		const { service, mocks } = createService();
		mocks.userPendingsRepository.findOneByOrFail.mockResolvedValue({
			id: 'pending1',
			code: 'code1',
			email: 'a@example.com',
			username: 'alice',
			password: 'hash',
		} as any);
		mocks.registrationTicketsRepository.findOneBy.mockResolvedValue({ id: 'ticket1', pendingUserId: 'pending1' } as any);
		const reply = createReply();

		await service.signupPending(createRequest({ code: 'code1' }), reply);

		expect(mocks.registrationTicketsRepository.update).toHaveBeenCalledWith('ticket1', expect.objectContaining({ pendingUserId: null }));
	});

	test('signupPending throws when pending user not found', async () => {
		const { service, mocks } = createService();
		mocks.userPendingsRepository.findOneByOrFail.mockRejectedValue(new Error('not found'));
		const reply = createReply();

		await expect(service.signupPending(createRequest({ code: 'bad' }), reply)).rejects.toThrow('not found');
	});

	test('signup throws when signupService fails', async () => {
		const { service, mocks } = createService();
		mocks.signupService.signup.mockRejectedValue(new Error('DUPLICATED_USERNAME'));
		const reply = createReply();

		await expect(service.signup(createRequest({ username: 'alice', password: 'pass' }), reply)).rejects.toThrow('DUPLICATED_USERNAME');
	});

	test('signup throws string error from signupService', async () => {
		const { service, mocks } = createService();
		mocks.signupService.signup.mockRejectedValue('DUPLICATED_USERNAME');
		const reply = createReply();

		await expect(service.signup(createRequest({ username: 'alice', password: 'pass' }), reply)).rejects.toThrow('DUPLICATED_USERNAME');
	});

	test('signup with registration disabled and missing invitation code returns 400', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: false,
			disableRegistration: true,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass' }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('signup with email required and ticket updates ticket for pending user', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: true,
			disableRegistration: true,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		mocks.registrationTicketsRepository.findOneBy.mockResolvedValue({
			id: 'ticket1',
			code: 'invite',
			usedAt: null,
			expiresAt: null,
		} as any);
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass', emailAddress: 'a@example.com', invitationCode: 'invite' }), reply);

		expect(mocks.registrationTicketsRepository.update).toHaveBeenCalledWith('ticket1', expect.objectContaining({ pendingUserId: expect.any(String) }));
		expect(reply.code).toHaveBeenCalledWith(204);
	});

	test('signupPending throws string error when pending user not found', async () => {
		const { service, mocks } = createService();
		mocks.userPendingsRepository.findOneByOrFail.mockRejectedValue('not found');
		const reply = createReply();

		await expect(service.signupPending(createRequest({ code: 'bad' }), reply)).rejects.toThrow('not found');
	});

	test('signup with email required returns 400 when emailAddress is not string', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: true,
			disableRegistration: false,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass', emailAddress: 123 }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('signup with registration disabled returns 400 when invitationCode is not string', async () => {
		const { service, mocks } = createService();
		mocks.metaService.fetch.mockResolvedValue({
			emailRequiredForSignup: false,
			disableRegistration: true,
			preservedUsernames: [],
			enableHcaptcha: false,
			enableRecaptcha: false,
			enableTurnstile: false,
		} as any);
		const reply = createReply();

		await service.signup(createRequest({ username: 'alice', password: 'pass', invitationCode: 123 }), reply);

		expect(reply.code).toHaveBeenCalledWith(400);
	});

	test('signupPending returns signin failure when signin fails', async () => {
		const { service, mocks } = createService();
		mocks.signinService.signin.mockResolvedValue({ success: false });
		const reply = createReply();

		const result = await service.signupPending(createRequest({ code: 'code1' }), reply);

		expect(result).toEqual({ success: false });
	});

	test('signupPending wraps object error', async () => {
		const { service, mocks } = createService();
		mocks.userPendingsRepository.findOneByOrFail.mockRejectedValue(new Error('object error'));
		const reply = createReply();

		await expect(service.signupPending(createRequest({ code: 'bad' }), reply)).rejects.toThrow('object error');
	});
});
