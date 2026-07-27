process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { QueryService } from '@/core/QueryService.js';
import { Brackets } from 'typeorm';

describe('QueryService', () => {
	function createQueryBuilder(alias: string = 'note'): any {
		const qb = {
			alias,
			andWhere: jest.fn().mockReturnThis(),
			orWhere: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			select: jest.fn().mockReturnThis(),
			orderBy: jest.fn().mockReturnThis(),
			setParameters: jest.fn().mockReturnThis(),
			getQuery: jest.fn().mockReturnValue(`subquery-${alias}`),
			getParameters: jest.fn().mockReturnValue({}),
		};
		return qb;
	}

	function createRepository(): any {
		return {
			createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilder()),
		};
	}

	function createService() {
		const repos: Record<string, any> = {};

		for (const name of ['blockings', 'followings', 'mutedNotes', 'noteThreadMutings', 'mutings', 'renoteMutings', 'userProfiles']) {
			repos[name] = createRepository();
		}

		const service = new QueryService(
			repos.userProfiles,
			repos.followings,
			repos.mutedNotes,
			repos.blockings,
			repos.noteThreadMutings,
			repos.mutings,
			repos.renoteMutings,
		);

		return { service, repos };
	}

	describe('makePaginationQuery', () => {
		test('orders by id desc when no params', () => {
			const { service } = createService();
			const q = createQueryBuilder();

			service.makePaginationQuery(q);

			expect(q.orderBy).toHaveBeenCalledWith('note.id', 'DESC');
		});

		test('uses sinceId and untilId', () => {
			const { service } = createService();
			const q = createQueryBuilder();

			service.makePaginationQuery(q, 'a', 'b');

			expect(q.andWhere).toHaveBeenCalledWith('note.id > :sinceId', { sinceId: 'a' });
			expect(q.andWhere).toHaveBeenCalledWith('note.id < :untilId', { untilId: 'b' });
			expect(q.orderBy).toHaveBeenCalledWith('note.id', 'DESC');
		});

		test('uses sinceId alone', () => {
			const { service } = createService();
			const q = createQueryBuilder();

			service.makePaginationQuery(q, 'a');

			expect(q.andWhere).toHaveBeenCalledWith('note.id > :sinceId', { sinceId: 'a' });
			expect(q.orderBy).toHaveBeenCalledWith('note.id', 'ASC');
		});

		test('uses untilId alone', () => {
			const { service } = createService();
			const q = createQueryBuilder();

			service.makePaginationQuery(q, undefined, 'b');

			expect(q.andWhere).toHaveBeenCalledWith('note.id < :untilId', { untilId: 'b' });
			expect(q.orderBy).toHaveBeenCalledWith('note.id', 'DESC');
		});

		test('uses sinceDate and untilDate', () => {
			const { service } = createService();
			const q = createQueryBuilder();

			service.makePaginationQuery(q, undefined, undefined, 1000, 2000);

			expect(q.andWhere).toHaveBeenCalledWith('note.createdAt > :sinceDate', { sinceDate: new Date(1000) });
			expect(q.andWhere).toHaveBeenCalledWith('note.createdAt < :untilDate', { untilDate: new Date(2000) });
			expect(q.orderBy).toHaveBeenCalledWith('note.createdAt', 'DESC');
		});
	});

	test('generateBlockedUserQuery adds blocking filters', () => {
		const { service, repos } = createService();
		const q = createQueryBuilder();

		service.generateBlockedUserQuery(q, { id: 'user1' });

		expect(q.andWhere).toHaveBeenCalledTimes(3);
		expect(q.setParameters).toHaveBeenCalled();
		expect(repos.blockings.createQueryBuilder).toHaveBeenCalledWith('blocking');
	});

	test('generateMutedUserQuery adds muting filters', () => {
		const { service, repos } = createService();
		const q = createQueryBuilder();

		service.generateMutedUserQuery(q, { id: 'user1' });

		expect(q.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
		expect(q.setParameters).toHaveBeenCalledTimes(2);
		expect(repos.mutings.createQueryBuilder).toHaveBeenCalledWith('muting');
		expect(repos.userProfiles.createQueryBuilder).toHaveBeenCalledWith('user_profile');
	});

	test('generateMutedUserQuery with exclude adds exclude filter', () => {
		const { service, repos } = createService();
		const mutingQb = createQueryBuilder('muting');
		repos.mutings.createQueryBuilder.mockReturnValue(mutingQb);
		const q = createQueryBuilder();

		service.generateMutedUserQuery(q, { id: 'user1' }, { id: 'exclude1' } as any);

		expect(mutingQb.andWhere).toHaveBeenCalledWith('muting.muteeId != :excludeId', { excludeId: 'exclude1' });
	});

	test('generateRepliesQuery without me filters for non-replies', () => {
		const { service } = createService();
		const q = createQueryBuilder();

		service.generateRepliesQuery(q, false);

		expect(q.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
	});

	test('generateRepliesQuery with me and without replies filters further', () => {
		const { service } = createService();
		const q = createQueryBuilder();

		service.generateRepliesQuery(q, false, { id: 'user1' });

		expect(q.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
	});

	test('generateVisibilityQuery without me restricts to public/home', () => {
		const { service } = createService();
		const q = createQueryBuilder();

		service.generateVisibilityQuery(q, null);

		expect(q.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
	});

	test('generateVisibilityQuery with me includes followers logic', () => {
		const { service, repos } = createService();
		const q = createQueryBuilder();

		service.generateVisibilityQuery(q, { id: 'user1' });

		expect(q.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
		expect(q.setParameters).toHaveBeenCalledWith({ meId: 'user1' });
		expect(repos.followings.createQueryBuilder).toHaveBeenCalledWith('following');
	});

	describe('makePaginationQuery date variants', () => {
		test('uses sinceDate alone', () => {
			const { service } = createService();
			const q = createQueryBuilder();

			service.makePaginationQuery(q, undefined, undefined, 1000);

			expect(q.andWhere).toHaveBeenCalledWith('note.createdAt > :sinceDate', { sinceDate: new Date(1000) });
			expect(q.orderBy).toHaveBeenCalledWith('note.createdAt', 'ASC');
		});

		test('uses untilDate alone', () => {
			const { service } = createService();
			const q = createQueryBuilder();

			service.makePaginationQuery(q, undefined, undefined, undefined, 2000);

			expect(q.andWhere).toHaveBeenCalledWith('note.createdAt < :untilDate', { untilDate: new Date(2000) });
			expect(q.orderBy).toHaveBeenCalledWith('note.createdAt', 'DESC');
		});
	});

	test('generateBlockQueryForUsers adds blocking and blocked filters', () => {
		const { service, repos } = createService();
		const q = createQueryBuilder();

		service.generateBlockQueryForUsers(q, { id: 'user1' });

		expect(q.andWhere).toHaveBeenCalledTimes(2);
		expect(q.setParameters).toHaveBeenCalledTimes(2);
		expect(repos.blockings.createQueryBuilder).toHaveBeenCalledTimes(2);
	});

	test('generateMutedNoteQuery adds muted note filter', () => {
		const { service, repos } = createService();
		const q = createQueryBuilder();

		service.generateMutedNoteQuery(q, { id: 'user1' });

		expect(q.andWhere).toHaveBeenCalled();
		expect(q.setParameters).toHaveBeenCalled();
		expect(repos.mutedNotes.createQueryBuilder).toHaveBeenCalledWith('muted');
	});

	test('generateMutedNoteThreadQuery adds thread mute filters', () => {
		const { service, repos } = createService();
		const q = createQueryBuilder();

		service.generateMutedNoteThreadQuery(q, { id: 'user1' });

		expect(q.andWhere).toHaveBeenCalledTimes(2);
		expect(q.setParameters).toHaveBeenCalled();
		expect(repos.noteThreadMutings.createQueryBuilder).toHaveBeenCalledWith('threadMuted');
	});

	test('generateMutedUserQueryForUsers adds muted user filter', () => {
		const { service, repos } = createService();
		const q = createQueryBuilder();

		service.generateMutedUserQueryForUsers(q, { id: 'user1' });

		expect(q.andWhere).toHaveBeenCalled();
		expect(q.setParameters).toHaveBeenCalled();
		expect(repos.mutings.createQueryBuilder).toHaveBeenCalledWith('muting');
	});

	test('generateRepliesQuery with me and withReplies true does nothing', () => {
		const { service } = createService();
		const q = createQueryBuilder();

		service.generateRepliesQuery(q, true, { id: 'user1' });

		expect(q.andWhere).not.toHaveBeenCalled();
	});

	test('generateMutedUserRenotesQueryForNotes adds renote mute filter', () => {
		const { service, repos } = createService();
		const q = createQueryBuilder();

		service.generateMutedUserRenotesQueryForNotes(q, { id: 'user1' });

		expect(q.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
		expect(q.setParameters).toHaveBeenCalled();
		expect(repos.renoteMutings.createQueryBuilder).toHaveBeenCalledWith('renote_muting');
	});

	test('generateMutedUserQuery without exclude does not add exclude filter', () => {
		const { service, repos } = createService();
		const mutingQb = createQueryBuilder('muting');
		repos.mutings.createQueryBuilder.mockReturnValue(mutingQb);
		const q = createQueryBuilder();

		service.generateMutedUserQuery(q, { id: 'user1' });

		expect(mutingQb.andWhere).not.toHaveBeenCalledWith('muting.muteeId != :excludeId', { excludeId: expect.anything() });
		expect(q.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
		expect(q.setParameters).toHaveBeenCalledTimes(2);
	});

	test('generateRepliesQuery without me filters non-replies and self-replies', () => {
		const { service } = createService();
		const q = createQueryBuilder();

		service.generateRepliesQuery(q, false);

		expect(q.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
	});
});
