process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'node:stream';
import { ApiCallService } from '@/server/api/ApiCallService.js';
import { ApiError } from '@/server/api/error.js';
import { AuthenticationError } from '@/server/api/AuthenticateService.js';
import { RateLimiterService } from '@/server/api/RateLimiterService.js';
import { AuthenticateService } from '@/server/api/AuthenticateService.js';
import { ApiLoggerService } from '@/server/api/ApiLoggerService.js';
import { RoleService } from '@/core/RoleService.js';
import { MetaService } from '@/core/MetaService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import type { UserIpsRepository } from '@/models/index.js';
import type { LocalUser } from '@/models/entities/User.js';
import type { AccessToken } from '@/models/entities/AccessToken.js';
import type { IEndpoint, IEndpointMeta } from '@/server/api/endpoints.js';
import type { Schema } from '@/misc/json-schema.js';

function createReply(): jest.Mocked<FastifyReply> & { sentData: unknown; statusCode: number } {
	const reply = {
		sentData: undefined as unknown,
		statusCode: 200,
		code: jest.fn(function (this: typeof reply, code: number) {
			this.statusCode = code;
			return this;
		}),
		header: jest.fn().mockReturnThis(),
		send: jest.fn(function (this: typeof reply, data?: unknown) {
			this.sentData = data;
			return this;
		}),
	} as unknown as jest.Mocked<FastifyReply> & { sentData: unknown; statusCode: number };
	return reply;
}

function createRequest(overrides: Partial<FastifyRequest<{ Body: Record<string, unknown>; Querystring: Record<string, unknown> }>> = {}): jest.Mocked<FastifyRequest<{ Body: Record<string, unknown>; Querystring: Record<string, unknown> }>> {
	return {
		method: 'POST',
		body: {},
		query: {},
		headers: {},
		ip: '127.0.0.1',
		...overrides,
	} as unknown as jest.Mocked<FastifyRequest<{ Body: Record<string, unknown>; Querystring: Record<string, unknown> }>>;
}

function createUser(data: Partial<LocalUser> = {}): LocalUser {
	return {
		id: 'user1',
		createdAt: new Date(),
		updatedAt: new Date(),
		lastFetchedAt: null,
		lastActiveDate: new Date(),
		hideOnlineStatus: false,
		username: 'alice',
		usernameLower: 'alice',
		name: null,
		followersCount: 0,
		followingCount: 0,
		movedToUri: null,
		movedAt: null,
		alsoKnownAs: null,
		notesCount: 0,
		avatarId: null,
		avatar: null,
		bannerId: null,
		banner: null,
		avatarUrl: null,
		bannerUrl: null,
		avatarBlurhash: null,
		bannerBlurhash: null,
		tags: [],
		isSuspended: false,
		isLocked: false,
		isBot: false,
		isCat: false,
		isRoot: false,
		isExplorable: true,
		isDeleted: false,
		emojis: [],
		host: null,
		inbox: null,
		sharedInbox: null,
		featured: null,
		uri: null,
		followersUri: null,
		token: null,
		...data,
	} as unknown as LocalUser;
}

function createAccessToken(data: Partial<AccessToken> = {}): AccessToken {
	return {
		id: 'token1',
		createdAt: new Date(),
		lastUsedAt: null,
		token: 'app-token',
		hash: 'app-token-hash',
		userId: 'user1',
		user: null,
		appId: 'app1',
		app: null,
		name: null,
		description: null,
		iconUrl: null,
		permission: ['read:account'],
		fetched: false,
		...data,
	} as unknown as AccessToken;
}

function createEndpointMeta(meta: Partial<IEndpointMeta> = {}): IEndpointMeta {
	return {
		...meta,
	};
}

function createEndpoint(overrides: Partial<IEndpoint & { exec: (data: any, user: any, token: any, file: any, ip: string, headers: any) => Promise<unknown> }> = {}): IEndpoint & { exec: jest.Mock } {
	const params: Schema = {
		type: 'object',
		properties: {
			count: { type: 'integer' },
			flag: { type: 'boolean' },
		},
	};

	return {
		name: 'test/endpoint',
		meta: createEndpointMeta(),
		params,
		exec: jest.fn().mockResolvedValue({ ok: true }),
		...overrides,
	} as unknown as IEndpoint & { exec: jest.Mock };
}

describe('ApiCallService', () => {
	let app: TestingModule;
	let apiCallService: ApiCallService;
	let userIpsRepository: jest.Mocked<UserIpsRepository>;
	let metaService: jest.Mocked<MetaService>;
	let authenticateService: jest.Mocked<AuthenticateService>;
	let rateLimiterService: jest.Mocked<RateLimiterService>;
	let roleService: jest.Mocked<RoleService>;
	let apiLoggerService: jest.Mocked<ApiLoggerService>;

	beforeEach(async () => {
		userIpsRepository = {
			createQueryBuilder: jest.fn().mockReturnValue({
				insert: jest.fn().mockReturnThis(),
				values: jest.fn().mockReturnThis(),
				orIgnore: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue(undefined),
			}),
		} as unknown as jest.Mocked<UserIpsRepository>;

		metaService = {
			fetch: jest.fn().mockResolvedValue({
				enableIpLogging: false,
				policies: {},
			}),
		} as unknown as jest.Mocked<MetaService>;

		authenticateService = {
			authenticate: jest.fn().mockResolvedValue([null, null]),
		} as unknown as jest.Mocked<AuthenticateService>;

		rateLimiterService = {
			limit: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<RateLimiterService>;

		roleService = {
			getUserPolicies: jest.fn().mockResolvedValue({
				gtlAvailable: true,
				ltlAvailable: true,
				canPublicNote: true,
				canInvite: false,
				inviteLimit: 0,
				inviteLimitCycle: 60 * 24 * 7,
				inviteExpirationTime: 0,
				canManageCustomEmojis: false,
				canSearchNotes: false,
				driveCapacityMb: 100,
				alwaysMarkNsfw: false,
				pinLimit: 5,
				antennaLimit: 5,
				wordMuteLimit: 200,
				webhookLimit: 3,
				userListLimit: 10,
				userEachUserListsLimit: 50,
				rateLimitFactor: 1,
			}),
			getUserRoles: jest.fn().mockResolvedValue([]),
			isModerator: jest.fn().mockResolvedValue(false),
			isAdministrator: jest.fn().mockResolvedValue(false),
		} as unknown as jest.Mocked<RoleService>;

		apiLoggerService = {
			logger: {
				error: jest.fn(),
				warn: jest.fn(),
				info: jest.fn(),
				debug: jest.fn(),
				success: jest.fn(),
			},
		} as unknown as jest.Mocked<ApiLoggerService>;

		app = await Test.createTestingModule({
			providers: [
				ApiCallService,
				{ provide: DI.userIpsRepository, useValue: userIpsRepository },
				{ provide: MetaService, useValue: metaService },
				{ provide: AuthenticateService, useValue: authenticateService },
				{ provide: RateLimiterService, useValue: rateLimiterService },
				{ provide: RoleService, useValue: roleService },
				{ provide: ApiLoggerService, useValue: apiLoggerService },
			],
		}).compile();

		apiCallService = app.get<ApiCallService>(ApiCallService);
	});

	afterEach(async () => {
		await app.close();
	});

	async function flushPromises(): Promise<void> {
		return new Promise(resolve => setImmediate(resolve));
	}

	function getCall(): (
		ep: IEndpoint & { exec: any },
		user: LocalUser | null | undefined,
		token: AccessToken | null | undefined,
		data: any,
		file: { name: string; path: string } | null,
		request: FastifyRequest<{ Body: Record<string, unknown> | undefined; Querystring: Record<string, unknown> }>,
	) => Promise<unknown> {
		return Reflect.get(apiCallService, 'call') as (
			ep: IEndpoint & { exec: any },
			user: LocalUser | null | undefined,
			token: AccessToken | null | undefined,
			data: any,
			file: { name: string; path: string } | null,
			request: FastifyRequest<{ Body: Record<string, unknown> | undefined; Querystring: Record<string, unknown> }>,
		) => Promise<unknown>;
	}

	function getSend(): (
		reply: FastifyReply,
		x?: unknown,
		y?: ApiError,
	) => void {
		return Reflect.get(apiCallService, 'send') as (
			reply: FastifyReply,
			x?: unknown,
			y?: ApiError,
		) => void;
	}

	describe('send', () => {
		test('sends 204 when response is null', () => {
			const reply = createReply();
			getSend()(reply, null);
			expect(reply.code).toHaveBeenCalledWith(204);
			expect(reply.send).toHaveBeenCalledWith();
			expect(reply.sentData).toBeUndefined();
		});

		test('sends error payload when status and ApiError provided', () => {
			const reply = createReply();
			const error = new ApiError({
				message: 'Bad request',
				code: 'BAD_REQUEST',
				id: 'bad-request-id',
				kind: 'client',
				httpStatusCode: 400,
			});
			getSend()(reply, 400, error);
			expect(reply.code).toHaveBeenCalledWith(400);
			expect(reply.send).toHaveBeenCalledWith({
				error: {
					message: 'Bad request',
					code: 'BAD_REQUEST',
					id: 'bad-request-id',
					kind: 'client',
				},
			});
		});

		test('stringifies string responses', () => {
			const reply = createReply();
			getSend()(reply, 'hello');
			expect(reply.send).toHaveBeenCalledWith(JSON.stringify('hello'));
		});

		test('sends object responses as-is', () => {
			const reply = createReply();
			getSend()(reply, { foo: 'bar' });
			expect(reply.send).toHaveBeenCalledWith({ foo: 'bar' });
		});
	});

	describe('call', () => {
		test('returns exec result for public endpoint', async () => {
			const endpoint = createEndpoint();
			const request = createRequest();
			const result = await getCall()(endpoint, null, null, { count: 1 }, null, request);
			expect(result).toEqual({ ok: true });
			expect(endpoint.exec).toHaveBeenCalledWith({ count: 1 }, null, null, null, '127.0.0.1', {});
		});

		test('throws access denied for secure endpoint without secure token', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ secure: true }) });
			const user = createUser();
			const token = createAccessToken();
			const request = createRequest();

			await expect(getCall()(endpoint, user, token, {}, null, request)).rejects.toThrow('Access denied.');
		});

		test('allows secure endpoint with native user token', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ secure: true }) });
			const user = createUser();
			const request = createRequest();

			const result = await getCall()(endpoint, user, null, {}, null, request);
			expect(result).toEqual({ ok: true });
		});

		test('applies rate limit for limited endpoint', async () => {
			const endpoint = createEndpoint({
				meta: createEndpointMeta({ limit: { duration: 1000, max: 10 } }),
			});
			const request = createRequest();

			await getCall()(endpoint, null, null, {}, null, request);

			expect(rateLimiterService.limit).toHaveBeenCalledWith(
				expect.objectContaining({ key: 'test/endpoint', duration: 1000, max: 10 }),
				expect.any(String),
				1,
			);
		});

		test('throws rate limit exceeded when limiter rejects', async () => {
			const endpoint = createEndpoint({
				meta: createEndpointMeta({ limit: { duration: 1000, max: 10 } }),
			});
			const request = createRequest();
			rateLimiterService.limit.mockRejectedValueOnce(new Error('RATE_LIMIT_EXCEEDED'));

			await expect(getCall()(endpoint, null, null, {}, null, request)).rejects.toThrow('Rate limit exceeded. Please try again later.');
		});

		test('throws credential required when endpoint requires credential and no user', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true }) });
			const request = createRequest();

			await expect(getCall()(endpoint, null, null, {}, null, request)).rejects.toThrow('Credential required.');
		});

		test('throws suspended error for suspended user', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true }) });
			const user = createUser({ isSuspended: true });
			const request = createRequest();

			await expect(getCall()(endpoint, user, null, {}, null, request)).rejects.toThrow('Your account has been suspended.');
		});

		test('throws moved error when endpoint prohibits moved users', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, prohibitMoved: true }) });
			const user = createUser({ movedToUri: 'https://example.com/users/alice' });
			const request = createRequest();

			await expect(getCall()(endpoint, user, null, {}, null, request)).rejects.toThrow('You have moved your account.');
		});

		test('throws moderator required error', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, requireModerator: true }) });
			const user = createUser();
			const request = createRequest();

			await expect(getCall()(endpoint, user, null, {}, null, request)).rejects.toThrow('You are not assigned to a moderator role.');
		});

		test('throws admin required error', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, requireAdmin: true }) });
			const user = createUser();
			roleService.getUserRoles.mockResolvedValueOnce([{ isModerator: true, isAdministrator: false } as any]);
			const request = createRequest();

			await expect(getCall()(endpoint, user, null, {}, null, request)).rejects.toThrow('You are not assigned to an administrator role.');
		});

		test('allows moderator endpoint for moderator', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, requireModerator: true }) });
			const user = createUser();
			roleService.getUserRoles.mockResolvedValueOnce([{ isModerator: true, isAdministrator: false } as any]);
			const request = createRequest();

			const result = await getCall()(endpoint, user, null, {}, null, request);
			expect(result).toEqual({ ok: true });
		});

		test('throws role policy required error', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, requireRolePolicy: 'canInvite' }) });
			const user = createUser();
			roleService.getUserPolicies.mockResolvedValueOnce({
				gtlAvailable: true,
				ltlAvailable: true,
				canPublicNote: true,
				canInvite: false,
				inviteLimit: 0,
				inviteLimitCycle: 60 * 24 * 7,
				inviteExpirationTime: 0,
				canManageCustomEmojis: false,
				canSearchNotes: false,
				driveCapacityMb: 100,
				alwaysMarkNsfw: false,
				pinLimit: 5,
				antennaLimit: 5,
				wordMuteLimit: 200,
				webhookLimit: 3,
				userListLimit: 10,
				userEachUserListsLimit: 50,
				rateLimitFactor: 1,
			});
			const request = createRequest();

			await expect(getCall()(endpoint, user, null, {}, null, request)).rejects.toThrow('You are not assigned to a required role.');
		});

		test('allows endpoint when role policy is satisfied', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, requireRolePolicy: 'canInvite' }) });
			const user = createUser();
			roleService.getUserPolicies.mockResolvedValueOnce({
				gtlAvailable: true,
				ltlAvailable: true,
				canPublicNote: true,
				canInvite: true,
				inviteLimit: 0,
				inviteLimitCycle: 60 * 24 * 7,
				inviteExpirationTime: 0,
				canManageCustomEmojis: false,
				canSearchNotes: false,
				driveCapacityMb: 100,
				alwaysMarkNsfw: false,
				pinLimit: 5,
				antennaLimit: 5,
				wordMuteLimit: 200,
				webhookLimit: 3,
				userListLimit: 10,
				userEachUserListsLimit: 50,
				rateLimitFactor: 1,
			});
			const request = createRequest();

			const result = await getCall()(endpoint, user, null, {}, null, request);
			expect(result).toEqual({ ok: true });
		});

		test('throws permission denied when token lacks required kind', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, kind: 'read:account' }) });
			const user = createUser();
			const token = createAccessToken({ permission: ['read:notes'] });
			const request = createRequest();

			await expect(getCall()(endpoint, user, token, {}, null, request)).rejects.toThrow('Your app does not have the necessary permissions to use this endpoint.');
		});

		test('casts string params to integer/boolean on GET requests', async () => {
			const endpoint = createEndpoint({
				meta: createEndpointMeta({ allowGet: true }),
				params: {
					type: 'object',
					properties: {
						count: { type: 'integer' },
						flag: { type: 'boolean' },
					},
				},
			});
			const request = createRequest({ method: 'GET', query: { count: '5', flag: 'true' } });

			await getCall()(endpoint, null, null, { count: '5', flag: 'true' }, null, request);

			expect(endpoint.exec).toHaveBeenCalledWith(
				expect.objectContaining({ count: 5, flag: true }),
				null,
				null,
				null,
				'127.0.0.1',
				{},
			);
		});

		test('throws invalid param when cast fails', async () => {
			const endpoint = createEndpoint({
				meta: createEndpointMeta({ allowGet: true }),
				params: {
					type: 'object',
					properties: {
						count: { type: 'integer' },
					},
				},
			});
			const request = createRequest({ method: 'GET', query: { count: 'not-a-number' } });

			await expect(getCall()(endpoint, null, null, { count: 'not-a-number' }, null, request)).rejects.toThrow('Invalid param.');
		});

		test('converts exec errors to internal api errors', async () => {
			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
			const endpoint = createEndpoint({
				exec: jest.fn().mockRejectedValueOnce(new Error('boom')),
			});
			const request = createRequest();

			await expect(getCall()(endpoint, null, null, {}, null, request)).rejects.toThrow('Internal error occurred. Please contact us if the error persists.');

			consoleErrorSpy.mockRestore();
		});

		test('rethrows ApiError from exec', async () => {
			const endpoint = createEndpoint({
				exec: jest.fn().mockRejectedValueOnce(new ApiError({
					message: 'Custom error',
					code: 'CUSTOM_ERROR',
					id: 'custom-id',
				})),
			});
			const request = createRequest();

			await expect(getCall()(endpoint, null, null, {}, null, request)).rejects.toThrow('Custom error');
		});
	});

	describe('handleRequest', () => {
		test('uses body token and returns exec result', async () => {
			const user = createUser();
			const token = createAccessToken();
			authenticateService.authenticate.mockResolvedValueOnce([user, token]);
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, kind: 'read:account' }) });
			const request = createRequest({ body: { i: 'token', count: 2 } });
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(authenticateService.authenticate).toHaveBeenCalledWith('token');
			expect(endpoint.exec).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }), user, token, null, '127.0.0.1', {});
			expect(reply.send).toHaveBeenCalledWith({ ok: true });
		});

		test('uses Authorization Bearer token', async () => {
			authenticateService.authenticate.mockResolvedValueOnce([null, null]);
			const endpoint = createEndpoint();
			const request = createRequest({ headers: { authorization: 'Bearer native-token' } });
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(authenticateService.authenticate).toHaveBeenCalledWith('native-token');
		});

		test('returns 400 when token is not a string', async () => {
			const endpoint = createEndpoint();
			const request = createRequest({ body: { i: 123 } });
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.code).toHaveBeenCalledWith(400);
			expect(reply.send).not.toHaveBeenCalled();
		});

		test('sets cache header for GET public cached endpoint without auth', async () => {
			authenticateService.authenticate.mockResolvedValueOnce([null, null]);
			const endpoint = createEndpoint({ meta: createEndpointMeta({ allowGet: true, cacheSec: 60 }) });
			const request = createRequest({ method: 'GET' });
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'public, max-age=60');
		});

		test('returns 401 on AuthenticationError', async () => {
			authenticateService.authenticate.mockRejectedValueOnce(new AuthenticationError('invalid token'));
			const endpoint = createEndpoint();
			const request = createRequest();
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.code).toHaveBeenCalledWith(401);
			expect(reply.header).toHaveBeenCalledWith('WWW-Authenticate', expect.stringContaining('invalid_token'));
		});

		test('returns 500 on unexpected authentication failure', async () => {
			authenticateService.authenticate.mockRejectedValueOnce(new Error('unexpected'));
			const endpoint = createEndpoint();
			const request = createRequest();
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.code).toHaveBeenCalledWith(500);
		});

		test('returns client error with proper status', async () => {
			authenticateService.authenticate.mockResolvedValueOnce([null, null]);
			const endpoint = createEndpoint({
				exec: jest.fn().mockRejectedValueOnce(new ApiError({
					message: 'Invalid param.',
					code: 'INVALID_PARAM',
					id: 'invalid-param-id',
					httpStatusCode: 400,
				})),
			});
			const request = createRequest();
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.code).toHaveBeenCalledWith(400);
			expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'INVALID_PARAM' }) }));
		});

		test('returns 403 permission denied with insufficient_scope', async () => {
			const user = createUser();
			const token = createAccessToken({ permission: [] });
			authenticateService.authenticate.mockResolvedValueOnce([user, token]);
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, kind: 'write:notes' }) });
			const request = createRequest();
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.code).toHaveBeenCalledWith(403);
			expect(reply.header).toHaveBeenCalledWith('WWW-Authenticate', expect.stringContaining('insufficient_scope'));
		});

		test('logs IP when user is present and IP logging is enabled', async () => {
			metaService.fetch.mockResolvedValueOnce({ enableIpLogging: true } as any);
			const user = createUser();
			authenticateService.authenticate.mockResolvedValueOnce([user, null]);
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true }) });
			const request = createRequest({ ip: '10.0.0.1' });
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(userIpsRepository.createQueryBuilder).toHaveBeenCalled();
		});

		test('skips IP logging when disabled', async () => {
			metaService.fetch.mockResolvedValueOnce({ enableIpLogging: false } as any);
			const user = createUser();
			authenticateService.authenticate.mockResolvedValueOnce([user, null]);
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true }) });
			const request = createRequest({ ip: '10.0.0.1' });
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(userIpsRepository.createQueryBuilder).not.toHaveBeenCalled();
		});

		test('deduplicates IP logging for same user and ip', async () => {
			metaService.fetch.mockResolvedValue({ enableIpLogging: true } as any);
			const user = createUser();
			authenticateService.authenticate.mockResolvedValue([user, null]);
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true }) });
			const request1 = createRequest({ ip: '10.0.0.1' });
			const request2 = createRequest({ ip: '10.0.0.1' });
			const reply1 = createReply();
			const reply2 = createReply();

			apiCallService.handleRequest(endpoint, request1, reply1);
			await flushPromises();
			apiCallService.handleRequest(endpoint, request2, reply2);
			await flushPromises();

			expect(userIpsRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
		});

		test('send includes info when ApiError has info', async () => {
			authenticateService.authenticate.mockResolvedValueOnce([null, null]);
			const endpoint = createEndpoint({
				exec: jest.fn().mockRejectedValueOnce(new ApiError({
					message: 'Bad request',
					code: 'BAD_REQUEST',
					id: 'bad-request-id',
					httpStatusCode: 400,
				}, { foo: 'bar' })),
			});
			const request = createRequest();
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ info: { foo: 'bar' } }) }));
		});

		test('handleMultipartRequest returns 400 when no file', async () => {
			const endpoint = createEndpoint();
			const request = createRequest({ method: 'POST', body: {} }) as any;
			request.file = jest.fn().mockResolvedValue(null);
			const reply = createReply();

			await apiCallService.handleMultipartRequest(endpoint, request, reply);

			expect(reply.code).toHaveBeenCalledWith(400);
		});

		test('handleMultipartRequest returns 400 when token is not string', async () => {
			const endpoint = createEndpoint();
			const request = createRequest({ method: 'POST', body: {} }) as any;
			request.file = jest.fn().mockResolvedValue({
				file: Readable.from(['file content']),
				fields: { i: { value: 123 } },
				filename: 'test.txt',
			});
			const reply = createReply();

			await apiCallService.handleMultipartRequest(endpoint, request, reply);

			expect(reply.code).toHaveBeenCalledWith(400);
		});

		test('handleMultipartRequest processes file successfully', async () => {
			const user = createUser();
			const token = createAccessToken();
			authenticateService.authenticate.mockResolvedValueOnce([user, token]);
			const endpoint = createEndpoint({
				meta: createEndpointMeta({ requireCredential: true, kind: 'read:account', requireFile: true }),
				params: {
					type: 'object',
					properties: {
						count: { type: 'integer' },
					},
				},
			});
			const request = createRequest({ method: 'POST', body: {} }) as any;
			request.file = jest.fn().mockResolvedValue({
				file: Readable.from(['file content']),
				fields: { i: { value: 'token' }, count: { value: '2' } },
				filename: 'test.txt',
			});
			const reply = createReply();

			await apiCallService.handleMultipartRequest(endpoint, request, reply);

			expect(authenticateService.authenticate).toHaveBeenCalledWith('token');
			expect(endpoint.exec).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }), user, token, expect.objectContaining({ name: 'test.txt' }), '127.0.0.1', {});
		});

		test('handleRequest skips cache header when token present', async () => {
			const user = createUser();
			authenticateService.authenticate.mockResolvedValueOnce([user, null]);
			const endpoint = createEndpoint({ meta: createEndpointMeta({ allowGet: true, cacheSec: 60 }) });
			const request = createRequest({ method: 'GET' });
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.header).not.toHaveBeenCalled();
		});

		test('handleRequest returns authentication error', async () => {
			authenticateService.authenticate.mockRejectedValueOnce(new AuthenticationError('invalid token'));
			const endpoint = createEndpoint();
			const request = createRequest();
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.code).toHaveBeenCalledWith(401);
		});

		test('handleRequest returns API client error', async () => {
			authenticateService.authenticate.mockResolvedValueOnce([null, null]);
			const endpoint = createEndpoint({
				exec: jest.fn().mockRejectedValueOnce(new ApiError({
					message: 'Forbidden',
					code: 'FORBIDDEN',
					id: 'forbidden-id',
					httpStatusCode: 403,
				})),
			});
			const request = createRequest();
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.code).toHaveBeenCalledWith(403);
		});

		test('call skips rate limit when factor is 0', async () => {
			const endpoint = createEndpoint({
				meta: createEndpointMeta({ limit: { duration: 1000, max: 10 } }),
			});
			const user = createUser();
			roleService.getUserPolicies.mockResolvedValueOnce({
				gtlAvailable: true,
				ltlAvailable: true,
				canPublicNote: true,
				canInvite: false,
				inviteLimit: 0,
				inviteLimitCycle: 60 * 24 * 7,
				inviteExpirationTime: 0,
				canManageCustomEmojis: false,
				canSearchNotes: false,
				driveCapacityMb: 100,
				alwaysMarkNsfw: false,
				pinLimit: 5,
				antennaLimit: 5,
				wordMuteLimit: 200,
				webhookLimit: 3,
				userListLimit: 10,
				userEachUserListsLimit: 50,
				rateLimitFactor: 0,
			});
			const request = createRequest();

			await getCall()(endpoint, user, null, {}, null, request);

			expect(rateLimiterService.limit).not.toHaveBeenCalled();
		});

		test('call allows root user to bypass moderator check', async () => {
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, requireModerator: true }) });
			const user = createUser({ isRoot: true });
			const request = createRequest();

			const result = await getCall()(endpoint, user, null, {}, null, request);

			expect(result).toEqual({ ok: true });
			expect(roleService.getUserRoles).not.toHaveBeenCalled();
		});

		test('call casts params for requireFile endpoint', async () => {
			const endpoint = createEndpoint({
				meta: createEndpointMeta({ requireFile: true }),
				params: {
					type: 'object',
					properties: {
						count: { type: 'integer' },
					},
				},
			});
			const request = createRequest({ method: 'POST' });

			await getCall()(endpoint, null, null, { count: '7' }, null, request);

			expect(endpoint.exec).toHaveBeenCalledWith(expect.objectContaining({ count: 7 }), null, null, null, '127.0.0.1', {});
		});

		test('logs a new IP for existing user IP set', async () => {
			metaService.fetch.mockResolvedValue({ enableIpLogging: true } as any);
			const user = createUser();
			authenticateService.authenticate.mockResolvedValue([user, null]);
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true }) });

			apiCallService.handleRequest(endpoint, createRequest({ ip: '10.0.0.1' }), createReply());
			await flushPromises();
			apiCallService.handleRequest(endpoint, createRequest({ ip: '10.0.0.2' }), createReply());
			await flushPromises();

			expect(userIpsRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
		});

		test('call respects custom limit key', async () => {
			const endpoint = createEndpoint({
				meta: createEndpointMeta({ limit: { key: 'custom-key', duration: 1000, max: 10 } }),
			});
			const request = createRequest();

			await getCall()(endpoint, null, null, {}, null, request);

			expect(rateLimiterService.limit).toHaveBeenCalledWith(
				expect.objectContaining({ key: 'custom-key' }),
				expect.any(String),
				1,
			);
		});

		test('call casts number params for GET requests', async () => {
			const endpoint = createEndpoint({
				meta: createEndpointMeta({ allowGet: true }),
				params: {
					type: 'object',
					properties: {
						price: { type: 'number' },
					},
				},
			});
			const request = createRequest({ method: 'GET', query: { price: '1.5' } });

			await getCall()(endpoint, null, null, { price: '1.5' }, null, request);

			expect(endpoint.exec).toHaveBeenCalledWith(
				expect.objectContaining({ price: 1.5 }),
				null,
				null,
				null,
				'127.0.0.1',
				{},
			);
		});

		test('handleRequest returns 500 for server ApiError without status', async () => {
			authenticateService.authenticate.mockResolvedValueOnce([null, null]);
			const endpoint = createEndpoint({
				exec: jest.fn().mockRejectedValueOnce(new ApiError({
					message: 'Server error',
					code: 'SERVER_ERROR',
					id: 'server-id',
					kind: 'server',
				})),
			});
			const request = createRequest();
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.code).toHaveBeenCalledWith(500);
			expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 'SERVER_ERROR' }) }));
		});

		test('handleRequest sets WWW-Authenticate for 401 exec errors', async () => {
			authenticateService.authenticate.mockResolvedValueOnce([null, null]);
			const endpoint = createEndpoint({
				exec: jest.fn().mockRejectedValueOnce(new ApiError({
					message: 'Unauthorized',
					code: 'UNAUTHORIZED',
					id: 'unauthorized-id',
					kind: 'client',
					httpStatusCode: 401,
				})),
			});
			const request = createRequest();
			const reply = createReply();

			apiCallService.handleRequest(endpoint, request, reply);
			await flushPromises();

			expect(reply.code).toHaveBeenCalledWith(401);
			expect(reply.header).toHaveBeenCalledWith('WWW-Authenticate', expect.stringContaining('Bearer'));
		});

		test('handleMultipartRequest uses Authorization Bearer token', async () => {
			const user = createUser();
			const token = createAccessToken();
			authenticateService.authenticate.mockResolvedValueOnce([user, token]);
			const endpoint = createEndpoint({ meta: createEndpointMeta({ requireCredential: true, kind: 'read:account' }) });
			const request = createRequest({ method: 'POST', headers: { authorization: 'Bearer multipart-token' } }) as any;
			request.file = jest.fn().mockResolvedValue({
				file: Readable.from(['file content']),
				fields: {},
				filename: 'test.txt',
			});
			const reply = createReply();

			await apiCallService.handleMultipartRequest(endpoint, request, reply);

			expect(authenticateService.authenticate).toHaveBeenCalledWith('multipart-token');
		});
	});

	test('dispose clears interval', () => {
		expect(() => apiCallService.dispose()).not.toThrow();
	});
});
