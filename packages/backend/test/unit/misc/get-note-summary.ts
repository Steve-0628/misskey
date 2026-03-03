process.env.NODE_ENV = 'test';

import { getNoteSummary } from '@/misc/get-note-summary.js';
import type { Packed } from '@/misc/json-schema.js';

type Note = Packed<'Note'>;
type DriveFile = Packed<'DriveFile'>;

function makeFile(id: string): DriveFile {
	return { id } as DriveFile;
}

function makeNote(overrides: Partial<Note> = {}): Note {
	return {
		id: 'test',
		createdAt: '2023-01-01T00:00:00.000Z',
		userId: 'user1',
		user: { id: 'user1', username: 'alice', name: 'Alice', host: null } as Note['user'],
		visibility: 'public',
		localOnly: false,
		reactionEmojis: {},
		reactions: {},
		...overrides,
	} as Note;
}

describe('getNoteSummary', () => {
	test('returns deleted marker when note is deleted', () => {
		const note = makeNote({ deletedAt: '2023-01-02T00:00:00.000Z' });
		expect(getNoteSummary(note)).toBe('(❌⛔)');
	});

	test('returns hidden marker when note is hidden', () => {
		const note = makeNote({ isHidden: true });
		expect(getNoteSummary(note)).toBe('(⛔)');
	});

	test('returns empty string for note with no text, cw, files, or poll', () => {
		const note = makeNote({ text: null });
		expect(getNoteSummary(note)).toBe('');
	});

	test('returns note text', () => {
		const note = makeNote({ text: 'Hello world' });
		expect(getNoteSummary(note)).toBe('Hello world');
	});

	test('returns CW instead of text when CW is present', () => {
		const note = makeNote({ text: 'Hidden body', cw: 'Content warning' });
		expect(getNoteSummary(note)).toBe('Content warning');
	});

	test('appends file count when files are attached', () => {
		const note = makeNote({ text: 'Look at this', files: [makeFile('f1'), makeFile('f2')] as Note['files'] });
		expect(getNoteSummary(note)).toBe('Look at this (📎2)');
	});

	test('appends poll indicator when poll is attached', () => {
		const note = makeNote({ text: 'Vote!', poll: { expiresAt: null, multiple: false, choices: [] } });
		expect(getNoteSummary(note)).toBe('Vote! (📊)');
	});

	test('appends reply summary when reply is present', () => {
		const reply = makeNote({ text: 'Original' });
		const note = makeNote({ text: 'Response', replyId: 'reply1', reply });
		expect(getNoteSummary(note)).toBe('Response\n\nRE: Original');
	});

	test('appends RE: ... when replyId is set but reply object is absent', () => {
		const note = makeNote({ text: 'Response', replyId: 'reply1' });
		expect(getNoteSummary(note)).toBe('Response\n\nRE: ...');
	});

	test('appends renote summary when renote is present', () => {
		const renote = makeNote({ text: 'Quoted note' });
		const note = makeNote({ text: 'My comment', renoteId: 'rn1', renote });
		expect(getNoteSummary(note)).toBe('My comment\n\nRN: Quoted note');
	});

	test('appends RN: ... when renoteId is set but renote object is absent', () => {
		const note = makeNote({ renoteId: 'rn1' });
		expect(getNoteSummary(note)).toBe('RN: ...');
	});

	test('trims leading/trailing whitespace from summary', () => {
		const note = makeNote({ text: '  spaced  ' });
		expect(getNoteSummary(note)).toBe('spaced');
	});

	test('combines files and poll indicators', () => {
		const note = makeNote({
			text: 'Both',
			files: [makeFile('f1')] as Note['files'],
			poll: { expiresAt: null, multiple: false, choices: [] },
		});
		expect(getNoteSummary(note)).toBe('Both (📎1) (📊)');
	});
});
