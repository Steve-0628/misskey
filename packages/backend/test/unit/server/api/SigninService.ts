process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { SigninService } from '@/server/api/SigninService.js';
import type { Config } from '@/config.js';
import type { SigninsRepository } from '@/models/index.js';
import type { IdService } from '@/core/IdService.js';
import type { SigninEntityService } from '@/core/entities/SigninEntityService.js';
import type { GlobalEventService } from '@/core/GlobalEventService.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { LocalUser } from '@/models/entities/User.js';

function createService() {
	const config = { url: 'https://example.com' } as unknown as Config;

	const signinsRepository = {
		insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'signin1' }] }),
		findOneByOrFail: jest.fn().mockResolvedValue({ id: 'signin1' }),
	} as unknown as jest.Mocked<SigninsRepository>;

	const signinEntityService = {
		pack: jest.fn().mockResolvedValue({ id: 'signin1' }),
	} as unknown as SigninEntityService;

	const idService = {
		genId: jest.fn().mockReturnValue('signin1'),
	} as unknown as IdService;

	const globalEventService = {
		publishMainStream: jest.fn(),
	} as unknown as GlobalEventService;

	const service = new SigninService(
		config,
		signinsRepository,
		signinEntityService,
		idService,
		globalEventService,
	);

	return { service, mocks: { signinsRepository } };
}

function createReply(): FastifyReply {
	return {
		code: jest.fn().mockReturnThis(),
	} as unknown as FastifyReply;
}

function createUser(): LocalUser {
	return {
		id: 'user1',
		token: 'token1',
		host: null,
	} as unknown as LocalUser;
}

describe('SigninService', () => {
	test('signin returns user id and token and sets reply code', () => {
		const setImmediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation(() => undefined as any);

		const { service, mocks } = createService();
		const request = { ip: '127.0.0.1', headers: {} } as unknown as FastifyRequest;
		const reply = createReply();
		const user = createUser();

		const result = service.signin(request, reply, user);

		expect(result).toEqual({ id: 'user1', i: 'token1' });
		expect(reply.code).toHaveBeenCalledWith(200);
		expect(mocks.signinsRepository.insert).not.toHaveBeenCalled();

		setImmediateSpy.mockRestore();
	});
});
