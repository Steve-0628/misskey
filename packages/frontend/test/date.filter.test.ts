import { describe, test, assert } from 'vitest';
import dateFilter, { dateString } from '../src/filters/date';

describe('date filter', () => {
	// Standard date for testing
	const d = new Date('2023-01-01T12:00:00.000Z');

	test('formats Date object', () => {
		const res = dateFilter(d);
		// Output depends on locale, but it should be a string.
		assert.isString(res);
		// Check basic year
		assert.include(res, '2023');
	});

	test('formats timestamp number', () => {
		const res = dateFilter(d.getTime());
		assert.isString(res);
		assert.include(res, '2023');
	});

	test('formats undefined (current time?)', () => {
		// dateFilter(undefined) -> dateTimeFormat.format(undefined)
		// Usually formats current time.
		const res = dateFilter(undefined);
		assert.isString(res);
	});

	describe('dateString', () => {
		test('formats date string', () => {
			const res = dateString('2023-01-01T12:00:00.000Z');
			assert.isString(res);
			assert.include(res, '2023');
		});
	});
});
