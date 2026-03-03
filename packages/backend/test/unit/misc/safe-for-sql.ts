process.env.NODE_ENV = 'test';

import { safeForSql } from '@/misc/safe-for-sql.js';

describe('safeForSql', () => {
	test('returns true for a plain safe string', () => {
		expect(safeForSql('hello')).toBe(true);
	});

	test('returns true for an empty string', () => {
		expect(safeForSql('')).toBe(true);
	});

	test('returns true for alphanumeric with spaces', () => {
		expect(safeForSql('hello world 123')).toBe(true);
	});

	test('returns false for null byte', () => {
		expect(safeForSql('\0')).toBe(false);
	});

	test('returns false for backspace (0x08)', () => {
		expect(safeForSql('\x08')).toBe(false);
	});

	test('returns false for horizontal tab (0x09)', () => {
		expect(safeForSql('\x09')).toBe(false);
	});

	test('returns false for substitute character (0x1a)', () => {
		expect(safeForSql('\x1a')).toBe(false);
	});

	test('returns false for newline', () => {
		expect(safeForSql('\n')).toBe(false);
	});

	test('returns false for carriage return', () => {
		expect(safeForSql('\r')).toBe(false);
	});

	test('returns false for double quote', () => {
		expect(safeForSql('"')).toBe(false);
	});

	test('returns false for single quote', () => {
		expect(safeForSql('\'')).toBe(false);
	});

	test('returns false for backslash', () => {
		expect(safeForSql('\\')).toBe(false);
	});

	test('returns false for percent sign', () => {
		expect(safeForSql('%')).toBe(false);
	});

	test('returns false for string containing dangerous character mid-string', () => {
		expect(safeForSql('hello\' world')).toBe(false);
	});

	test('returns true for unicode letters without dangerous chars', () => {
		expect(safeForSql('こんにちは')).toBe(true);
	});
});
