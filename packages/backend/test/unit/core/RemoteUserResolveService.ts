process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { WebfingerService } from '@/core/WebfingerService.js';
import { RemoteLoggerService } from '@/core/RemoteLoggerService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { ApDbResolverService } from '@/core/activitypub/ApDbResolverService.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { UsersRepository } from '@/models/index.js';
import { User } from '@/models/entities/User.js';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import type { ILink, IWebFinger } from '@/core/WebfingerService.js';
import type { TestingModule } from '@nestjs/testing';

function createLocalUser(data: Partial<User> = {}): LocalUser {
	return new User({
		id: 'local1',
		createdAt: new Date(),
		username: 'alice',
		usernameLower: 'alice',
		host: null,
		uri: null,
		...data,
	}) as LocalUser;
}

function createRemoteUser(data: Partial<User> = {}): RemoteUser {
	return new User({
		id: 'remote1',
		createdAt: new Date(),
		username: 'bob',
		usernameLower: 'bob',
		host: 'remote.example',
		uri: 'https://remote.example/users/bob',
		lastFetchedAt: new Date(),
		...data,
	}) as RemoteUser;
}

function createWebfinger(href: string): IWebFinger {
	return {
		subject: `acct:user@${href.includes('remote.example') ? 'remote.example' : 'example.com'}`,
		links: [{ rel: 'self', href }],
	};
}

describe('RemoteUserResolveService', () => {
	let app: TestingModule;
	let remoteUserResolveService: RemoteUserResolveService;
	let usersRepository: jest.Mocked<UsersRepository>;
	let utilityService: jest.Mocked<UtilityService>;
	let webfingerService: jest.Mocked<WebfingerService>;
	let apDbResolverService: jest.Mocked<ApDbResolverService>;
	let apPersonService: jest.Mocked<ApPersonService>;
	let subLogger: { info: jest.Mock; succ: jest.Mock; error: jest.Mock };

	beforeEach(async () => {
		usersRepository = {
			findOneBy: jest.fn(),
			update: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		utilityService = {
			toPuny: jest.fn((host: string) => host.toLowerCase()),
		} as unknown as jest.Mocked<UtilityService>;

		webfingerService = {
			webfinger: jest.fn(),
		} as unknown as jest.Mocked<WebfingerService>;

		apDbResolverService = {
			parseUri: jest.fn(),
			getUserFromApId: jest.fn(),
		} as unknown as jest.Mocked<ApDbResolverService>;

		apPersonService = {
			createPerson: jest.fn(),
			updatePerson: jest.fn(),
		} as unknown as jest.Mocked<ApPersonService>;

		subLogger = {
			info: jest.fn(),
			succ: jest.fn(),
			error: jest.fn(),
		};

		const remoteLoggerService = {
			logger: {
				createSubLogger: jest.fn().mockReturnValue(subLogger),
			},
		} as unknown as jest.Mocked<RemoteLoggerService>;

		const config: Config = {
			host: 'example.com',
			url: 'https://example.com',
		} as Config;

		app = await Test.createTestingModule({
			providers: [
				RemoteUserResolveService,
				{ provide: DI.config, useValue: config },
				{ provide: DI.usersRepository, useValue: usersRepository },
				{ provide: UtilityService, useValue: utilityService },
				{ provide: WebfingerService, useValue: webfingerService },
				{ provide: RemoteLoggerService, useValue: remoteLoggerService },
				{ provide: ApDbResolverService, useValue: apDbResolverService },
				{ provide: ApPersonService, useValue: apPersonService },
			],
		}).compile();

		remoteUserResolveService = app.get<RemoteUserResolveService>(RemoteUserResolveService);
	});

	afterEach(async () => {
		await app.close();
	});

	describe('resolveUser', () => {
		test('returns local user when host is null', async () => {
			const local = createLocalUser();
			usersRepository.findOneBy.mockResolvedValue(local);

			const result = await remoteUserResolveService.resolveUser('Alice', null);

			expect(result).toBe(local);
			expect(usersRepository.findOneBy).toHaveBeenCalledWith({
				usernameLower: 'alice',
				host: expect.anything(),
			});
		});

		test('throws when local user is not found and host is null', async () => {
			usersRepository.findOneBy.mockResolvedValue(null);

			await expect(remoteUserResolveService.resolveUser('Alice', null))
				.rejects.toThrow('user not found');
		});

		test('returns local user when host matches config host', async () => {
			const local = createLocalUser();
			usersRepository.findOneBy.mockResolvedValue(local);

			const result = await remoteUserResolveService.resolveUser('Alice', 'example.com');

			expect(result).toBe(local);
			expect(utilityService.toPuny).toHaveBeenCalledWith('example.com');
		});

		test('throws when local user is not found for config host', async () => {
			usersRepository.findOneBy.mockResolvedValue(null);

			await expect(remoteUserResolveService.resolveUser('Alice', 'example.com'))
				.rejects.toThrow('user not found');
		});

		test('returns existing remote user without resync when fresh', async () => {
			const remote = createRemoteUser({ lastFetchedAt: new Date() });
			usersRepository.findOneBy.mockResolvedValue(remote);

			const result = await remoteUserResolveService.resolveUser('Bob', 'remote.example');

			expect(result).toBe(remote);
			expect(webfingerService.webfinger).not.toHaveBeenCalled();
			expect(apPersonService.updatePerson).not.toHaveBeenCalled();
		});

		test('creates new remote user when not found locally', async () => {
			const selfHref = 'https://remote.example/users/bob';
			const created = createRemoteUser({ uri: selfHref });
			usersRepository.findOneBy.mockResolvedValue(null);
			webfingerService.webfinger.mockResolvedValue(createWebfinger(selfHref));
			apPersonService.createPerson.mockResolvedValue(created);

			const result = await remoteUserResolveService.resolveUser('Bob', 'remote.example');

			expect(result).toBe(created);
			expect(webfingerService.webfinger).toHaveBeenCalledWith('bob@remote.example');
			expect(apPersonService.createPerson).toHaveBeenCalledWith(selfHref);
			expect(apDbResolverService.parseUri).not.toHaveBeenCalled();
		});

		test('returns local user via AP id when new remote resolves to local uri', async () => {
			const selfHref = 'https://example.com/users/local1';
			const local = createLocalUser({ id: 'local1', username: 'local1', usernameLower: 'local1' });
			usersRepository.findOneBy.mockResolvedValue(null);
			webfingerService.webfinger.mockResolvedValue(createWebfinger(selfHref));
			apDbResolverService.parseUri.mockReturnValue({ local: true, type: 'users', id: 'local1' });
			apDbResolverService.getUserFromApId.mockResolvedValue(local);

			const result = await remoteUserResolveService.resolveUser('Bob', 'remote.example');

			expect(result).toBe(local);
			expect(apDbResolverService.parseUri).toHaveBeenCalledWith(selfHref);
			expect(apDbResolverService.getUserFromApId).toHaveBeenCalledWith(selfHref);
			expect(apPersonService.createPerson).not.toHaveBeenCalled();
		});

		test('creates remote user when local AP id parse does not point to users', async () => {
			const selfHref = 'https://example.com/notes/note1';
			const created = createRemoteUser({ uri: selfHref });
			usersRepository.findOneBy.mockResolvedValue(null);
			webfingerService.webfinger.mockResolvedValue(createWebfinger(selfHref));
			apDbResolverService.parseUri.mockReturnValue({ local: true, type: 'notes', id: 'note1' });
			apPersonService.createPerson.mockResolvedValue(created);

			const result = await remoteUserResolveService.resolveUser('Bob', 'remote.example');

			expect(result).toBe(created);
			expect(apPersonService.createPerson).toHaveBeenCalledWith(selfHref);
		});

		test('throws when WebFinger fails for new remote user', async () => {
			usersRepository.findOneBy.mockResolvedValue(null);
			webfingerService.webfinger.mockRejectedValue(new Error('network error'));

			await expect(remoteUserResolveService.resolveUser('Bob', 'remote.example'))
				.rejects.toThrow('Failed to WebFinger for bob@remote.example');
		});

		test('throws when self link is missing for new remote user', async () => {
			usersRepository.findOneBy.mockResolvedValue(null);
			webfingerService.webfinger.mockResolvedValue({
				subject: 'acct:bob@remote.example',
				links: [{ rel: 'not-self', href: 'https://remote.example/users/bob' }],
			});

			await expect(remoteUserResolveService.resolveUser('Bob', 'remote.example'))
				.rejects.toThrow('self link not found');
		});

		test('resyncs and returns user when lastFetchedAt is null', async () => {
			const remote = createRemoteUser({ lastFetchedAt: null });
			const selfHref = remote.uri;
			const resynced = createRemoteUser({ id: 'remote1', uri: selfHref, lastFetchedAt: new Date() });
			usersRepository.findOneBy.mockResolvedValueOnce(remote).mockResolvedValueOnce(resynced);
			usersRepository.update.mockResolvedValue(undefined);
			webfingerService.webfinger.mockResolvedValue(createWebfinger(selfHref));
			apPersonService.updatePerson.mockResolvedValue(undefined);

			const result = await remoteUserResolveService.resolveUser('Bob', 'remote.example');

			expect(result).toBe(resynced);
			expect(usersRepository.update).toHaveBeenCalledWith(remote.id, { lastFetchedAt: expect.any(Date) });
			expect(apPersonService.updatePerson).toHaveBeenCalledWith(selfHref);
		});

		test('resyncs stale remote user with matching uri', async () => {
			const remote = createRemoteUser({ lastFetchedAt: new Date('2020-01-01') });
			const selfHref = remote.uri;
			const resynced = createRemoteUser({ id: 'remote1', uri: selfHref, lastFetchedAt: new Date() });
			usersRepository.findOneBy.mockResolvedValueOnce(remote).mockResolvedValueOnce(resynced);
			usersRepository.update.mockResolvedValue(undefined);
			webfingerService.webfinger.mockResolvedValue(createWebfinger(selfHref));
			apPersonService.updatePerson.mockResolvedValue(undefined);

			const result = await remoteUserResolveService.resolveUser('Bob', 'remote.example');

			expect(result).toBe(resynced);
			expect(apPersonService.updatePerson).toHaveBeenCalledWith(selfHref);
			expect(usersRepository.update).toHaveBeenCalledWith(
				remote.id,
				expect.objectContaining({ lastFetchedAt: expect.any(Date) }),
			);
		});

		test('updates uri and resyncs when uri mismatch points to same host', async () => {
			const remote = createRemoteUser({ uri: 'https://remote.example/users/old-bob', lastFetchedAt: null });
			const selfHref = 'https://remote.example/users/bob';
			const resynced = createRemoteUser({ uri: selfHref, lastFetchedAt: new Date() });
			usersRepository.findOneBy.mockResolvedValueOnce(remote).mockResolvedValueOnce(resynced);
			usersRepository.update.mockResolvedValue(undefined);
			webfingerService.webfinger.mockResolvedValue(createWebfinger(selfHref));
			apPersonService.updatePerson.mockResolvedValue(undefined);

			const result = await remoteUserResolveService.resolveUser('Bob', 'remote.example');

			expect(result).toBe(resynced);
			expect(usersRepository.update).toHaveBeenCalledWith(
				{ usernameLower: 'bob', host: 'remote.example' },
				{ uri: selfHref },
			);
			expect(apPersonService.updatePerson).toHaveBeenCalledWith(selfHref);
		});

		test('throws when uri mismatch hostname differs from host', async () => {
			const remote = createRemoteUser({ uri: 'https://remote.example/users/bob', lastFetchedAt: null });
			const selfHref = 'https://evil.example/users/bob';
			usersRepository.findOneBy.mockResolvedValueOnce(remote);
			usersRepository.update.mockResolvedValue(undefined);
			webfingerService.webfinger.mockResolvedValue(createWebfinger(selfHref));

			await expect(remoteUserResolveService.resolveUser('Bob', 'remote.example'))
				.rejects.toThrow('Invalid uri');
		});

		test('throws when resynced user cannot be found', async () => {
			const remote = createRemoteUser({ lastFetchedAt: null });
			const selfHref = remote.uri;
			usersRepository.findOneBy.mockResolvedValueOnce(remote).mockResolvedValueOnce(null);
			usersRepository.update.mockResolvedValue(undefined);
			webfingerService.webfinger.mockResolvedValue(createWebfinger(selfHref));
			apPersonService.updatePerson.mockResolvedValue(undefined);

			await expect(remoteUserResolveService.resolveUser('Bob', 'remote.example'))
				.rejects.toThrow('user not found');
		});

		test('throws when local AP user is not found during local uri resolution', async () => {
			const selfHref = 'https://example.com/users/missing';
			usersRepository.findOneBy.mockResolvedValue(null);
			webfingerService.webfinger.mockResolvedValue(createWebfinger(selfHref));
			apDbResolverService.parseUri.mockReturnValue({ local: true, type: 'users', id: 'missing' });
			apDbResolverService.getUserFromApId.mockResolvedValue(null);

			await expect(remoteUserResolveService.resolveUser('Bob', 'remote.example'))
				.rejects.toThrow('local user not found');
		});
	});
});
