process.env.NODE_ENV = 'test';

import { describe, test, expect } from '@jest/globals';
import {
	dateUTC,
	isTimeSame,
	isTimeBefore,
	isTimeAfter,
	addTime,
	subtractTime,
} from '@/misc/prelude/time.js';

describe('prelude/time', () => {
	describe('dateUTC', () => {
		test('creates UTC date from [year, month]', () => {
			const d = dateUTC([2024, 0]);
			expect(d.getUTCFullYear()).toBe(2024);
			expect(d.getUTCMonth()).toBe(0);
			expect(d.getUTCDate()).toBe(1);
		});

		test('creates UTC date from full parts', () => {
			const d = dateUTC([2024, 5, 15, 12, 30, 45, 123]);
			expect(d.getUTCFullYear()).toBe(2024);
			expect(d.getUTCMonth()).toBe(5);
			expect(d.getUTCDate()).toBe(15);
			expect(d.getUTCHours()).toBe(12);
			expect(d.getUTCMinutes()).toBe(30);
			expect(d.getUTCSeconds()).toBe(45);
			expect(d.getUTCMilliseconds()).toBe(123);
		});

		test('throws on wrong number of arguments', () => {
			expect(() => dateUTC([])).toThrow('wrong number of arguments');
			expect(() => dateUTC([2024])).toThrow('wrong number of arguments');
			expect(() => dateUTC([2024, 0, 1, 0, 0, 0, 0, 0])).toThrow('wrong number of arguments');
		});
	});

	describe('isTimeSame', () => {
		test('returns true for identical timestamps', () => {
			const d = new Date('2024-01-01T00:00:00.000Z');
			expect(isTimeSame(d, new Date(d.getTime()))).toBe(true);
		});

		test('returns false for different timestamps', () => {
			expect(isTimeSame(new Date(0), new Date(1))).toBe(false);
		});
	});

	describe('isTimeBefore', () => {
		test('returns true when first is earlier', () => {
			expect(isTimeBefore(new Date(0), new Date(1000))).toBe(true);
		});

		test('returns false when equal', () => {
			expect(isTimeBefore(new Date(1000), new Date(1000))).toBe(false);
		});
	});

	describe('isTimeAfter', () => {
		test('returns true when first is later', () => {
			expect(isTimeAfter(new Date(1000), new Date(0))).toBe(true);
		});

		test('returns false when equal', () => {
			expect(isTimeAfter(new Date(1000), new Date(1000))).toBe(false);
		});
	});

	describe('addTime', () => {
		test('adds milliseconds by default', () => {
			expect(addTime(new Date(0), 1000).getTime()).toBe(1000);
		});

		test('adds days', () => {
			expect(addTime(new Date(0), 2, 'day').getTime()).toBe(2 * 86400000);
		});

		test('adds hours', () => {
			expect(addTime(new Date(0), 3, 'hour').getTime()).toBe(3 * 3600000);
		});
	});

	describe('subtractTime', () => {
		test('subtracts milliseconds by default', () => {
			expect(subtractTime(new Date(1000), 500).getTime()).toBe(500);
		});

		test('subtracts days', () => {
			expect(subtractTime(new Date(2 * 86400000), 1, 'day').getTime()).toBe(86400000);
		});
	});
});
