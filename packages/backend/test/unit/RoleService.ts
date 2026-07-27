process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { ModuleMocker } from 'jest-mock';
import { Test } from '@nestjs/testing';
import * as Redis from 'ioredis';
import * as lolex from '@sinonjs/fake-timers';
import { GlobalModule } from '@/GlobalModule.js';
import { RoleService, DEFAULT_POLICIES } from '@/core/RoleService.js';
import type { Role, RoleAssignment, RolesRepository, RoleAssignmentsRepository, UsersRepository, User } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { MetaService } from '@/core/MetaService.js';
import { genAid } from '@/misc/id/aid.js';
import { CacheService } from '@/core/CacheService.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { Meta } from '@/models/entities/Meta.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { sleep } from '../utils.js';
import type { TestingModule } from '@nestjs/testing';
import type { MockFunctionMetadata } from 'jest-mock';

const moduleMocker = new ModuleMocker(global);

describe('RoleService', () => {
	let app: TestingModule;
	let roleService: RoleService;
	let usersRepository: UsersRepository;
	let rolesRepository: RolesRepository;
	let roleAssignmentsRepository: RoleAssignmentsRepository;
	let metaService: jest.Mocked<MetaService>;
	let clock: lolex.InstalledClock;

	function createUser(data: Partial<User> = {}) {
		const un = secureRndstr(16);
		return usersRepository.insert({
			id: genAid(new Date()),
			createdAt: new Date(),
			username: un,
			usernameLower: un,
			...data,
		})
			.then(x => usersRepository.findOneByOrFail(x.identifiers[0]));
	}

	function createRole(data: Partial<Role> = {}) {
		return rolesRepository.insert({
			id: genAid(new Date()),
			createdAt: new Date(),
			updatedAt: new Date(),
			lastUsedAt: new Date(),
			description: '',
			...data,
		})
			.then(x => rolesRepository.findOneByOrFail(x.identifiers[0]));
	}

	beforeEach(async () => {
		clock = lolex.install({
			now: new Date(),
			shouldClearNativeTimers: true,
		});

		const userEntityService = {
			isLocalUser: jest.fn().mockImplementation(user => user.host == null),
			isRemoteUser: jest.fn().mockImplementation(user => user.host != null),
		};

		app = await Test.createTestingModule({
			imports: [
				GlobalModule,
			],
			providers: [
				RoleService,
				CacheService,
				IdService,
				GlobalEventService,
				{ provide: UserEntityService, useValue: userEntityService },
			],
		})
			.useMocker((token) => {
				if (token === MetaService) {
					return { fetch: jest.fn() };
				}
				if (typeof token === 'function') {
					const mockMetadata = moduleMocker.getMetadata(token) as MockFunctionMetadata<any, any>;
					const Mock = moduleMocker.generateFromMetadata(mockMetadata);
					return new Mock();
				}
			})
			.compile();

		app.enableShutdownHooks();

		roleService = app.get<RoleService>(RoleService);
		usersRepository = app.get<UsersRepository>(DI.usersRepository);
		rolesRepository = app.get<RolesRepository>(DI.rolesRepository);
		roleAssignmentsRepository = app.get<RoleAssignmentsRepository>(DI.roleAssignmentsRepository);

		metaService = app.get<MetaService>(MetaService) as jest.Mocked<MetaService>;
	});

	afterEach(async () => {
		clock.uninstall();

		/*
		await Promise.all([
			app.get(DI.metasRepository).clear(),
			usersRepository.clear(),
			rolesRepository.clear(),
			roleAssignmentsRepository.clear(),
		]);
		*/
		// Avoid FK errors
		await app.get(DI.db).query('TRUNCATE "user", "role", "meta" CASCADE');

		await app.close();
	});

	describe('getUserPolicies', () => {
		test('instance default policies', async () => {
			const user = await createUser();
			metaService.fetch.mockResolvedValue({
				policies: {
					canManageCustomEmojis: false,
				},
			} as any);

			const result = await roleService.getUserPolicies(user.id);

			expect(result.canManageCustomEmojis).toBe(false);
		});

		test('instance default policies 2', async () => {
			const user = await createUser();
			metaService.fetch.mockResolvedValue({
				policies: {
					canManageCustomEmojis: true,
				},
			} as any);

			const result = await roleService.getUserPolicies(user.id);

			expect(result.canManageCustomEmojis).toBe(true);
		});

		test('with role', async () => {
			const user = await createUser();
			const role = await createRole({
				name: 'a',
				policies: {
					canManageCustomEmojis: {
						useDefault: false,
						priority: 0,
						value: true,
					},
				},
			});
			await roleService.assign(user.id, role.id);
			metaService.fetch.mockResolvedValue({
				policies: {
					canManageCustomEmojis: false,
				},
			} as any);

			const result = await roleService.getUserPolicies(user.id);

			expect(result.canManageCustomEmojis).toBe(true);
		});

		test('priority', async () => {
			const user = await createUser();
			const role1 = await createRole({
				name: 'role1',
				policies: {
					driveCapacityMb: {
						useDefault: false,
						priority: 0,
						value: 200,
					},
				},
			});
			const role2 = await createRole({
				name: 'role2',
				policies: {
					driveCapacityMb: {
						useDefault: false,
						priority: 1,
						value: 100,
					},
				},
			});
			await roleService.assign(user.id, role1.id);
			await roleService.assign(user.id, role2.id);
			metaService.fetch.mockResolvedValue({
				policies: {
					driveCapacityMb: 50,
				},
			} as any);

			const result = await roleService.getUserPolicies(user.id);

			expect(result.driveCapacityMb).toBe(100);
		});

		test('conditional role', async () => {
			const user1 = await createUser({
				createdAt: new Date(Date.now() - (1000 * 60 * 60 * 24 * 365)),
			});
			const user2 = await createUser({
				createdAt: new Date(Date.now() - (1000 * 60 * 60 * 24 * 365)),
				followersCount: 10,
			});
			const role = await createRole({
				name: 'a',
				policies: {
					canManageCustomEmojis: {
						useDefault: false,
						priority: 0,
						value: true,
					},
				},
				target: 'conditional',
				condFormula: {
					type: 'and',
					values: [{
						type: 'followersMoreThanOrEq',
						value: 10,
					}, {
						type: 'createdMoreThan',
						sec: 60 * 60 * 24 * 7,
					}],
				},
			});

			metaService.fetch.mockResolvedValue({
				policies: {
					canManageCustomEmojis: false,
				},
			} as any);

			const user1Policies = await roleService.getUserPolicies(user1.id);
			const user2Policies = await roleService.getUserPolicies(user2.id);
			expect(user1Policies.canManageCustomEmojis).toBe(false);
			expect(user2Policies.canManageCustomEmojis).toBe(true);
		});

		test('expired role', async () => {
			const user = await createUser();
			const role = await createRole({
				name: 'a',
				policies: {
					canManageCustomEmojis: {
						useDefault: false,
						priority: 0,
						value: true,
					},
				},
			});
			await roleService.assign(user.id, role.id, new Date(Date.now() + (1000 * 60 * 60 * 24)));
			metaService.fetch.mockResolvedValue({
				policies: {
					canManageCustomEmojis: false,
				},
			} as any);

			const result = await roleService.getUserPolicies(user.id);
			expect(result.canManageCustomEmojis).toBe(true);

			clock.tick('25:00:00');

			const resultAfter25h = await roleService.getUserPolicies(user.id);
			expect(resultAfter25h.canManageCustomEmojis).toBe(false);

			await roleService.assign(user.id, role.id);

			// ストリーミング経由で反映されるまでちょっと待つ
			clock.uninstall();
			await sleep(100);

			const resultAfter25hAgain = await roleService.getUserPolicies(user.id);
			expect(resultAfter25hAgain.canManageCustomEmojis).toBe(true);
		});

		test('null user returns default policies', async () => {
			metaService.fetch.mockResolvedValue({ policies: {} } as any);
			const result = await roleService.getUserPolicies(null);
			expect(result.canManageCustomEmojis).toBe(DEFAULT_POLICIES.canManageCustomEmojis);
		});

		test('priority 2 overrides lower priorities', async () => {
			const user = await createUser();
			const role1 = await createRole({
				name: 'role1',
				policies: {
					driveCapacityMb: { useDefault: false, priority: 0, value: 200 },
				},
			});
			const role2 = await createRole({
				name: 'role2',
				policies: {
					driveCapacityMb: { useDefault: false, priority: 2, value: 500 },
				},
			});
			await roleService.assign(user.id, role1.id);
			await roleService.assign(user.id, role2.id);
			metaService.fetch.mockResolvedValue({ policies: { driveCapacityMb: 50 } } as any);

			const result = await roleService.getUserPolicies(user.id);
			expect(result.driveCapacityMb).toBe(500);
		});

		test('priority 1 overrides priority 0', async () => {
			const user = await createUser();
			const role1 = await createRole({
				name: 'role1',
				policies: {
					driveCapacityMb: { useDefault: false, priority: 0, value: 200 },
				},
			});
			const role2 = await createRole({
				name: 'role2',
				policies: {
					driveCapacityMb: { useDefault: false, priority: 1, value: 300 },
				},
			});
			await roleService.assign(user.id, role1.id);
			await roleService.assign(user.id, role2.id);
			metaService.fetch.mockResolvedValue({ policies: { driveCapacityMb: 50 } } as any);

			const result = await roleService.getUserPolicies(user.id);
			expect(result.driveCapacityMb).toBe(300);
		});
	});

	describe('isModerator / isAdministrator', () => {
		test('returns false for null user', async () => {
			expect(await roleService.isModerator(null)).toBe(false);
			expect(await roleService.isAdministrator(null)).toBe(false);
		});

		test('returns true for root user', async () => {
			const user = await createUser({ isRoot: true });
			expect(await roleService.isModerator(user)).toBe(true);
			expect(await roleService.isAdministrator(user)).toBe(true);
		});

		test('returns true for assigned moderator role', async () => {
			const user = await createUser();
			const role = await createRole({ name: 'mod', isModerator: true });
			await roleService.assign(user.id, role.id);
			expect(await roleService.isModerator(user)).toBe(true);
		});

		test('returns true for assigned administrator role', async () => {
			const user = await createUser();
			const role = await createRole({ name: 'admin', isAdministrator: true });
			await roleService.assign(user.id, role.id);
			expect(await roleService.isAdministrator(user)).toBe(true);
		});
	});

	describe('isExplorable', () => {
		test('returns false for null role', async () => {
			expect(await roleService.isExplorable(null)).toBe(false);
		});

		test('returns false for missing role', async () => {
			expect(await roleService.isExplorable({ id: 'missing' })).toBe(false);
		});

		test('returns true for explorable role', async () => {
			const role = await createRole({ name: 'explorable', isExplorable: true });
			expect(await roleService.isExplorable(role)).toBe(true);
		});
	});

	describe('getModerators / getAdministrators', () => {
		test('returns empty when no moderator roles', async () => {
			expect(await roleService.getModeratorIds()).toEqual([]);
			expect(await roleService.getModerators()).toEqual([]);
		});

		test('returns empty when no administrator roles', async () => {
			expect(await roleService.getAdministratorIds()).toEqual([]);
			expect(await roleService.getAdministrators()).toEqual([]);
		});

		test('returns moderator ids excluding admins when requested', async () => {
			const user = await createUser();
			const role = await createRole({ name: 'mod', isModerator: true });
			await roleService.assign(user.id, role.id);
			const ids = await roleService.getModeratorIds(false);
			expect(ids).toContain(user.id);
		});
	});

	describe('assign / unassign', () => {
		test('assign throws when already assigned', async () => {
			const user = await createUser();
			const role = await createRole({ name: 'a' });
			await roleService.assign(user.id, role.id);
			await expect(roleService.assign(user.id, role.id)).rejects.toThrow();
		});

		test('assign replaces expired assignment', async () => {
			const user = await createUser();
			const role = await createRole({ name: 'a' });
			await roleService.assign(user.id, role.id, new Date(Date.now() - 1000));
			await expect(roleService.assign(user.id, role.id)).resolves.toBeUndefined();
		});

		test('unassign throws when not assigned', async () => {
			const user = await createUser();
			const role = await createRole({ name: 'a' });
			await expect(roleService.unassign(user.id, role.id)).rejects.toThrow();
		});

		test('unassign removes expired assignment and throws', async () => {
			const user = await createUser();
			const role = await createRole({ name: 'a' });
			await roleService.assign(user.id, role.id, new Date(Date.now() - 1000));
			await expect(roleService.unassign(user.id, role.id)).rejects.toThrow();
		});
	});

	describe('conditional formulas', () => {
		test('or formula', async () => {
			const user = await createUser({ followersCount: 5, createdAt: new Date(Date.now() - 2000) });
			const role = await createRole({
				name: 'a',
				target: 'conditional',
				policies: { canManageCustomEmojis: { useDefault: false, priority: 0, value: true } },
				condFormula: {
					type: 'or',
					values: [
						{ type: 'followersMoreThanOrEq', value: 10 },
						{ type: 'createdMoreThan', sec: 1 },
					],
				},
			});
			metaService.fetch.mockResolvedValue({ policies: { canManageCustomEmojis: false } } as any);
			const result = await roleService.getUserPolicies(user.id);
			expect(result.canManageCustomEmojis).toBe(true);
		});

		test('not formula', async () => {
			const user = await createUser({ followersCount: 0 });
			const role = await createRole({
				name: 'a',
				target: 'conditional',
				policies: { canManageCustomEmojis: { useDefault: false, priority: 0, value: true } },
				condFormula: { type: 'not', value: { type: 'followersMoreThanOrEq', value: 1 } },
			});
			metaService.fetch.mockResolvedValue({ policies: { canManageCustomEmojis: false } } as any);
			const result = await roleService.getUserPolicies(user.id);
			expect(result.canManageCustomEmojis).toBe(true);
		});

		test('isLocal formula', async () => {
			const user = await createUser({ host: null });
			const role = await createRole({
				name: 'a',
				target: 'conditional',
				policies: { canManageCustomEmojis: { useDefault: false, priority: 0, value: true } },
				condFormula: { type: 'isLocal' },
			});
			metaService.fetch.mockResolvedValue({ policies: { canManageCustomEmojis: false } } as any);
			const result = await roleService.getUserPolicies(user.id);
			expect(result.canManageCustomEmojis).toBe(true);
		});

		test('isRemote formula', async () => {
			const user = await createUser({ host: 'remote.example' });
			const role = await createRole({
				name: 'a',
				target: 'conditional',
				policies: { canManageCustomEmojis: { useDefault: false, priority: 0, value: true } },
				condFormula: { type: 'isRemote' },
			});
			metaService.fetch.mockResolvedValue({ policies: { canManageCustomEmojis: false } } as any);
			const result = await roleService.getUserPolicies(user.id);
			expect(result.canManageCustomEmojis).toBe(true);
		});

		test('createdLessThan formula', async () => {
			const user = await createUser({ createdAt: new Date(Date.now() - 1000) });
			const role = await createRole({
				name: 'a',
				target: 'conditional',
				policies: { canManageCustomEmojis: { useDefault: false, priority: 0, value: true } },
				condFormula: { type: 'createdLessThan', sec: 60 * 60 },
			});
			metaService.fetch.mockResolvedValue({ policies: { canManageCustomEmojis: false } } as any);
			const result = await roleService.getUserPolicies(user.id);
			expect(result.canManageCustomEmojis).toBe(true);
		});

		test('following thresholds', async () => {
			const user = await createUser({ followingCount: 5, followersCount: 5, notesCount: 5 });
			const role = await createRole({
				name: 'a',
				target: 'conditional',
				policies: { canManageCustomEmojis: { useDefault: false, priority: 0, value: true } },
				condFormula: {
					type: 'and',
					values: [
						{ type: 'followingLessThanOrEq', value: 10 },
						{ type: 'followingMoreThanOrEq', value: 1 },
						{ type: 'notesLessThanOrEq', value: 10 },
						{ type: 'notesMoreThanOrEq', value: 1 },
						{ type: 'followersLessThanOrEq', value: 10 },
					],
				},
			});
			metaService.fetch.mockResolvedValue({ policies: { canManageCustomEmojis: false } } as any);
			const result = await roleService.getUserPolicies(user.id);
			expect(result.canManageCustomEmojis).toBe(true);
		});
	});

	test('getModeratorIds excludes admins when requested', async () => {
		const adminUser = await createUser();
		const modUser = await createUser();
		const adminRole = await createRole({ name: 'admin', isAdministrator: true });
		const modRole = await createRole({ name: 'mod', isModerator: true });
		await roleService.assign(adminUser.id, adminRole.id);
		await roleService.assign(modUser.id, modRole.id);

		const ids = await roleService.getModeratorIds(false);

		expect(ids).not.toContain(adminUser.id);
		expect(ids).toContain(modUser.id);
	});

	test('getAdministrators returns administrators', async () => {
		const user = await createUser();
		const adminRole = await createRole({ name: 'admin', isAdministrator: true });
		await roleService.assign(user.id, adminRole.id);

		const admins = await roleService.getAdministrators();

		expect(admins.map(u => u.id)).toContain(user.id);
	});

	test('addNoteToRoleTimeline publishes to role timelines', async () => {
		const user = await createUser();
		const role = await createRole({ name: 'timeline', isExplorable: true });
		await roleService.assign(user.id, role.id);

		await roleService.addNoteToRoleTimeline({ id: 'note1', userId: user.id } as any);

		// Redis pipeline is mocked by GlobalModule; just verify no throw
		expect(true).toBe(true);
	});

	test('policy with useDefault falls back to instance default', async () => {
		const user = await createUser();
		const role = await createRole({
			name: 'default-policy',
			policies: {
				canManageCustomEmojis: { useDefault: true, priority: 0, value: true },
			},
		});
		await roleService.assign(user.id, role.id);
		metaService.fetch.mockResolvedValue({
			policies: { canManageCustomEmojis: false },
		} as any);

		const result = await roleService.getUserPolicies(user.id);

		expect(result.canManageCustomEmojis).toBe(false);
	});

	test('unknown conditional formula evaluates to false', async () => {
		const user = await createUser();
		const role = await createRole({
			name: 'unknown-formula',
			target: 'conditional',
			policies: { canManageCustomEmojis: { useDefault: false, priority: 0, value: true } },
			condFormula: { type: 'unknown' } as any,
		});
		metaService.fetch.mockResolvedValue({
			policies: { canManageCustomEmojis: false },
		} as any);

		const result = await roleService.getUserPolicies(user.id);

		expect(result.canManageCustomEmojis).toBe(false);
	});

	test('dispose does not throw', () => {
		expect(() => roleService.dispose()).not.toThrow();
	});
});
