process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
	MemoryKVCache,
	MemorySingleCache,
	RedisKVCache,
	RedisSingleCache,
} from '@/misc/cache.js';
import type * as Redis from 'ioredis';

describe('misc:cache', () => {
	beforeEach(() => {
		jest.useFakeTimers({ doNotFake: [] });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('MemoryKVCache', () => {
		let cache: MemoryKVCache<string>;

		afterEach(() => {
			cache.dispose();
		});

		test('set and get', () => {
			cache = new MemoryKVCache(1000 * 60);
			cache.set('foo', 'bar');
			expect(cache.get('foo')).toBe('bar');
		});

		test('get returns undefined when key does not exist', () => {
			cache = new MemoryKVCache(1000 * 60);
			expect(cache.get('missing')).toBeUndefined();
		});

		test('get returns undefined and deletes expired entry', () => {
			cache = new MemoryKVCache(1);
			cache.set('foo', 'bar');
			jest.advanceTimersByTime(2);
			expect(cache.get('foo')).toBeUndefined();
			expect(cache.cache.has('foo')).toBe(false);
		});

		test('delete removes entry', () => {
			cache = new MemoryKVCache(1000 * 60);
			cache.set('foo', 'bar');
			cache.delete('foo');
			expect(cache.get('foo')).toBeUndefined();
		});

		test('fetch returns cached value on hit', async () => {
			cache = new MemoryKVCache(1000 * 60);
			cache.set('foo', 'bar');
			const fetcher = jest.fn().mockResolvedValue('baz');

			const result = await cache.fetch('foo', fetcher);

			expect(result).toBe('bar');
			expect(fetcher).not.toHaveBeenCalled();
		});

		test('fetch calls fetcher and stores value on miss', async () => {
			cache = new MemoryKVCache(1000 * 60);
			const fetcher = jest.fn().mockResolvedValue('baz');

			const result = await cache.fetch('foo', fetcher);

			expect(result).toBe('baz');
			expect(fetcher).toHaveBeenCalledTimes(1);
			expect(cache.get('foo')).toBe('baz');
		});

		test('fetch passes previous cached value to fetcher', async () => {
			cache = new MemoryKVCache<string, { value: string }>(1000 * 60, {
				toMapConverter: (value) => ({ value }),
				fromMapConverter: (cached) => cached.value,
			});
			cache.set('foo', 'bar');
			const fetcher = jest.fn().mockResolvedValue('baz');
			const validator = jest.fn().mockReturnValue(false);

			await cache.fetch('foo', fetcher, validator);

			expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ value: 'bar' }));
		});

		test('fetch uses validator and refetches on invalid cached value', async () => {
			cache = new MemoryKVCache(1000 * 60);
			cache.set('foo', 'bar');
			const fetcher = jest.fn().mockResolvedValue('baz');
			const validator = jest.fn().mockReturnValue(false);

			const result = await cache.fetch('foo', fetcher, validator);

			expect(validator).toHaveBeenCalledWith('bar');
			expect(result).toBe('baz');
		});

		test('fetchMaybe does not store undefined', async () => {
			cache = new MemoryKVCache(1000 * 60);
			const fetcher = jest.fn().mockResolvedValue(undefined);

			const result = await cache.fetchMaybe('foo', fetcher);

			expect(result).toBeUndefined();
			expect(cache.get('foo')).toBeUndefined();
		});

		test('gc removes expired entries', () => {
			cache = new MemoryKVCache(1);
			cache.set('a', '1');
			cache.set('b', '2');
			jest.advanceTimersByTime(2);
			cache.gc();
			expect(cache.get('a')).toBeUndefined();
			expect(cache.get('b')).toBeUndefined();
		});

		test('gc does nothing for Infinity lifetime', () => {
			cache = new MemoryKVCache(Infinity);
			cache.set('a', '1');
			cache.gc();
			expect(cache.get('a')).toBe('1');
		});

		test('dispose clears interval', () => {
			cache = new MemoryKVCache(1000 * 60);
			expect(() => cache.dispose()).not.toThrow();
		});
	});

	describe('MemorySingleCache', () => {
		let cache: MemorySingleCache<string>;

		test('set and get', () => {
			cache = new MemorySingleCache(1000 * 60);
			cache.set('bar');
			expect(cache.get()).toBe('bar');
		});

		test('get returns undefined when empty', () => {
			cache = new MemorySingleCache(1000 * 60);
			expect(cache.get()).toBeUndefined();
		});

		test('get returns undefined when expired', () => {
			cache = new MemorySingleCache(1);
			cache.set('bar');
			jest.advanceTimersByTime(2);
			expect(cache.get()).toBeUndefined();
		});

		test('delete clears value', () => {
			cache = new MemorySingleCache(1000 * 60);
			cache.set('bar');
			cache.delete();
			expect(cache.get()).toBeUndefined();
		});

		test('fetch returns cached value on hit', async () => {
			cache = new MemorySingleCache(1000 * 60);
			cache.set('bar');
			const fetcher = jest.fn().mockResolvedValue('baz');

			const result = await cache.fetch(fetcher);

			expect(result).toBe('bar');
			expect(fetcher).not.toHaveBeenCalled();
		});

		test('fetch calls fetcher and stores value on miss', async () => {
			cache = new MemorySingleCache(1000 * 60);
			const fetcher = jest.fn().mockResolvedValue('baz');

			const result = await cache.fetch(fetcher);

			expect(result).toBe('baz');
			expect(cache.get()).toBe('baz');
		});

		test('fetchMaybe does not store undefined', async () => {
			cache = new MemorySingleCache(1000 * 60);
			const fetcher = jest.fn().mockResolvedValue(undefined);

			const result = await cache.fetchMaybe(fetcher);

			expect(result).toBeUndefined();
			expect(cache.get()).toBeUndefined();
		});
	});

	describe('RedisKVCache', () => {
		let redisClient: jest.Mocked<Redis.Redis>;
		let cache: RedisKVCache<string>;

		beforeEach(() => {
			redisClient = {
				get: jest.fn().mockResolvedValue(null),
				set: jest.fn().mockResolvedValue('OK'),
				del: jest.fn().mockResolvedValue(1),
			} as unknown as jest.Mocked<Redis.Redis>;
		});

		afterEach(() => {
			cache.dispose();
		});

		test('set without expiration', async () => {
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: Infinity,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});

			await cache.set('foo', 'bar');

			expect(redisClient.set).toHaveBeenCalledWith('kvcache:test:foo', 'bar');
			expect(await cache.get('foo')).toBe('bar');
		});

		test('set with expiration', async () => {
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: 5000,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});

			await cache.set('foo', 'bar');

			expect(redisClient.set).toHaveBeenCalledWith('kvcache:test:foo', 'bar', 'EX', 5);
		});

		test('get returns memory cached value without calling redis', async () => {
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});
			await cache.set('foo', 'bar');

			const result = await cache.get('foo');

			expect(result).toBe('bar');
			expect(redisClient.get).not.toHaveBeenCalled();
		});

		test('get returns redis value on memory miss', async () => {
			redisClient.get.mockResolvedValue('bar');
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});

			const result = await cache.get('foo');

			expect(redisClient.get).toHaveBeenCalledWith('kvcache:test:foo');
			expect(result).toBe('bar');
		});

		test('get returns undefined when redis returns null', async () => {
			redisClient.get.mockResolvedValue(null);
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});

			const result = await cache.get('foo');

			expect(result).toBeUndefined();
		});

		test('delete removes value from memory and redis', async () => {
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});
			await cache.set('foo', 'bar');

			await cache.delete('foo');

			expect(redisClient.del).toHaveBeenCalledWith('kvcache:test:foo');
			expect(await cache.get('foo')).toBeUndefined();
		});

		test('fetch returns cached value on hit', async () => {
			const fetcher = jest.fn().mockResolvedValue('baz');
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher,
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});
			await cache.set('foo', 'bar');

			const result = await cache.fetch('foo');

			expect(result).toBe('bar');
			expect(fetcher).not.toHaveBeenCalled();
		});

		test('fetch calls fetcher and stores value on miss', async () => {
			const fetcher = jest.fn().mockResolvedValue('baz');
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher,
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});

			const result = await cache.fetch('foo');

			expect(result).toBe('baz');
			expect(fetcher).toHaveBeenCalledWith('foo');
			expect(redisClient.set).toHaveBeenCalledWith('kvcache:test:foo', 'baz', 'EX', 60);
		});

		test('refresh always fetches and stores value', async () => {
			const fetcher = jest.fn().mockResolvedValue('baz');
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher,
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});
			await cache.set('foo', 'bar');

			await cache.refresh('foo');

			expect(fetcher).toHaveBeenCalledWith('foo');
			expect(await cache.get('foo')).toBe('baz');
		});

		test('gc delegates to memory cache', async () => {
			cache = new RedisKVCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});
			await cache.set('foo', 'bar');
			jest.setSystemTime(Date.now() + 1000 * 60 * 60);
			cache.gc();
			expect(await cache.get('foo')).toBeUndefined();
		});
	});

	describe('RedisSingleCache', () => {
		let redisClient: jest.Mocked<Redis.Redis>;
		let cache: RedisSingleCache<string>;

		beforeEach(() => {
			redisClient = {
				get: jest.fn().mockResolvedValue(null),
				set: jest.fn().mockResolvedValue('OK'),
				del: jest.fn().mockResolvedValue(1),
			} as unknown as jest.Mocked<Redis.Redis>;
		});

		test('set and get with memory cache hit', async () => {
			cache = new RedisSingleCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});

			await cache.set('bar');
			const result = await cache.get();

			expect(result).toBe('bar');
			expect(redisClient.get).not.toHaveBeenCalled();
		});

		test('get falls back to redis', async () => {
			redisClient.get.mockResolvedValue('bar');
			cache = new RedisSingleCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});

			const result = await cache.get();

			expect(result).toBe('bar');
			expect(redisClient.get).toHaveBeenCalledWith('singlecache:test');
		});

		test('fetch returns cached value on hit', async () => {
			const fetcher = jest.fn().mockResolvedValue('baz');
			cache = new RedisSingleCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher,
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});
			await cache.set('bar');

			const result = await cache.fetch();

			expect(result).toBe('bar');
			expect(fetcher).not.toHaveBeenCalled();
		});

		test('fetch calls fetcher and stores value on miss', async () => {
			const fetcher = jest.fn().mockResolvedValue('baz');
			cache = new RedisSingleCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher,
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});

			const result = await cache.fetch();

			expect(result).toBe('baz');
			expect(fetcher).toHaveBeenCalledTimes(1);
			expect(redisClient.set).toHaveBeenCalledWith('singlecache:test', 'baz', 'EX', 60);
		});

		test('delete removes value', async () => {
			cache = new RedisSingleCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher: jest.fn(),
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});
			await cache.set('bar');

			await cache.delete();

			expect(redisClient.del).toHaveBeenCalledWith('singlecache:test');
			expect(await cache.get()).toBeUndefined();
		});

		test('refresh always fetches and stores value', async () => {
			const fetcher = jest.fn().mockResolvedValue('baz');
			cache = new RedisSingleCache(redisClient, 'test', {
				lifetime: 1000 * 60,
				memoryCacheLifetime: 1000 * 60,
				fetcher,
				toRedisConverter: (value) => value,
				fromRedisConverter: (value) => value,
			});
			await cache.set('bar');

			await cache.refresh();

			expect(fetcher).toHaveBeenCalledTimes(1);
			expect(await cache.get()).toBe('baz');
		});
	});
});
