import { jest } from '@jest/globals';

export type MockQueryBuilder<T = unknown> = {
	where: jest.Mock;
	andWhere: jest.Mock;
	orWhere: jest.Mock;
	select: jest.Mock;
	orderBy: jest.Mock;
	addOrderBy: jest.Mock;
	limit: jest.Mock;
	offset: jest.Mock;
	cache: jest.Mock;
	innerJoin: jest.Mock;
	getMany: jest.Mock<Promise<T[]>>;
	getCount: jest.Mock<Promise<number>>;
	getRawOne: jest.Mock<Promise<Record<string, unknown> | null>>;
};

export function createMockQueryBuilder<T = unknown>(): MockQueryBuilder<T> {
	const builder = {
		where: jest.fn(() => builder),
		andWhere: jest.fn(() => builder),
		orWhere: jest.fn(() => builder),
		select: jest.fn(() => builder),
		orderBy: jest.fn(() => builder),
		addOrderBy: jest.fn(() => builder),
		limit: jest.fn(() => builder),
		offset: jest.fn(() => builder),
		cache: jest.fn(() => builder),
		innerJoin: jest.fn(() => builder),
		getMany: jest.fn(),
		getCount: jest.fn(),
		getRawOne: jest.fn(),
	};
	return builder as MockQueryBuilder<T>;
}
