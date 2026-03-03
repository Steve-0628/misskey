process.env.NODE_ENV = 'test';

import { sqlLikeEscape } from '@/misc/sql-like-escape.js';

describe('sqlLikeEscape', () => {
	test('escapes percent sign', () => {
		expect(sqlLikeEscape('100%')).toBe('100\\%');
	});

	test('escapes underscore', () => {
		expect(sqlLikeEscape('user_name')).toBe('user\\_name');
	});

	test('escapes multiple percent signs', () => {
		expect(sqlLikeEscape('%%')).toBe('\\%\\%');
	});

	test('escapes multiple underscores', () => {
		expect(sqlLikeEscape('__')).toBe('\\_\\_');
	});

	test('escapes mixed percent and underscore', () => {
		expect(sqlLikeEscape('%_')).toBe('\\%\\_');
	});

	test('leaves plain text unchanged', () => {
		expect(sqlLikeEscape('hello')).toBe('hello');
	});

	test('leaves empty string unchanged', () => {
		expect(sqlLikeEscape('')).toBe('');
	});

	test('does not double-escape already escaped sequences', () => {
		// Input already has backslash — function only targets % and _
		expect(sqlLikeEscape('foo\\bar')).toBe('foo\\bar');
	});

	test('handles string with only special chars', () => {
		expect(sqlLikeEscape('%')).toBe('\\%');
		expect(sqlLikeEscape('_')).toBe('\\_');
	});

	test('handles mixed text with special chars mid-string', () => {
		expect(sqlLikeEscape('mis%key_project')).toBe('mis\\%key\\_project');
	});
});
