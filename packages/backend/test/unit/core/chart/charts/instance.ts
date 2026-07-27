process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import InstanceChart from '@/core/chart/charts/instance.js';
import type { DataSource } from 'typeorm';
import type { UsersRepository, NotesRepository, DriveFilesRepository, FollowingsRepository } from '@/models/index.js';
import type { UtilityService } from '@/core/UtilityService.js';
import type { AppLockService } from '@/core/AppLockService.js';
import type { ChartLoggerService } from '@/core/chart/ChartLoggerService.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import type { Note } from '@/models/entities/Note.js';

describe('InstanceChart', () => {
	function createChart() {
		const commit = jest.fn().mockResolvedValue(undefined);

		const db = {
			getRepository: jest.fn().mockReturnValue({}),
		} as unknown as DataSource;

		const chart = new InstanceChart(
			db,
			{} as UsersRepository,
			{} as NotesRepository,
			{} as DriveFilesRepository,
			{} as FollowingsRepository,
			{ toPuny: (h: string) => h.toLowerCase() } as UtilityService,
			{ getChartInsertLock: jest.fn() } as unknown as AppLockService,
			{ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } } as unknown as ChartLoggerService,
		);

		(chart as any).commit = commit;

		return { chart, commit };
	}

	test('requestReceived commits received counter', async () => {
		const { chart, commit } = createChart();

		await chart.requestReceived('Example.com');

		expect(commit).toHaveBeenCalledWith({ 'requests.received': 1 }, 'example.com');
	});

	test('requestSent commits succeeded counter when true', async () => {
		const { chart, commit } = createChart();

		await chart.requestSent('Example.com', true);

		expect(commit).toHaveBeenCalledWith({ 'requests.succeeded': 1, 'requests.failed': 0 }, 'example.com');
	});

	test('requestSent commits failed counter when false', async () => {
		const { chart, commit } = createChart();

		await chart.requestSent('Example.com', false);

		expect(commit).toHaveBeenCalledWith({ 'requests.succeeded': 0, 'requests.failed': 1 }, 'example.com');
	});

	test('newUser commits total and inc counters', async () => {
		const { chart, commit } = createChart();

		await chart.newUser('Example.com');

		expect(commit).toHaveBeenCalledWith({ 'users.total': 1, 'users.inc': 1 }, 'example.com');
	});

	describe('updateNote', () => {
		function createNote(data: Partial<Note> = {}): Note {
			return {
				id: 'note1',
				replyId: null,
				renoteId: null,
				fileIds: [],
				...data,
			} as unknown as Note;
		}

		test('commits normal note counters when adding', async () => {
			const { chart, commit } = createChart();
			const note = createNote();

			await chart.updateNote('Example.com', note, true);

			expect(commit).toHaveBeenCalledWith(expect.objectContaining({
				'notes.total': 1,
				'notes.inc': 1,
				'notes.dec': 0,
				'notes.diffs.normal': 1,
				'notes.diffs.renote': 0,
				'notes.diffs.reply': 0,
				'notes.diffs.withFile': 0,
			}), 'example.com');
		});

		test('commits renote counters when removing', async () => {
			const { chart, commit } = createChart();
			const note = createNote({ renoteId: 'renote1' });

			await chart.updateNote('Example.com', note, false);

			expect(commit).toHaveBeenCalledWith(expect.objectContaining({
				'notes.total': -1,
				'notes.inc': 0,
				'notes.dec': 1,
				'notes.diffs.normal': 0,
				'notes.diffs.renote': -1,
				'notes.diffs.reply': 0,
				'notes.diffs.withFile': 0,
			}), 'example.com');
		});

		test('commits reply and file counters when adding', async () => {
			const { chart, commit } = createChart();
			const note = createNote({ replyId: 'reply1', fileIds: ['file1'] });

			await chart.updateNote('Example.com', note, true);

			expect(commit).toHaveBeenCalledWith(expect.objectContaining({
				'notes.total': 1,
				'notes.inc': 1,
				'notes.dec': 0,
				'notes.diffs.normal': 0,
				'notes.diffs.renote': 0,
				'notes.diffs.reply': 1,
				'notes.diffs.withFile': 1,
			}), 'example.com');
		});
	});

	test('updateFollowing increments counters when adding', async () => {
		const { chart, commit } = createChart();

		await chart.updateFollowing('Example.com', true);

		expect(commit).toHaveBeenCalledWith({
			'following.total': 1,
			'following.inc': 1,
			'following.dec': 0,
		}, 'example.com');
	});

	test('updateFollowing decrements counters when removing', async () => {
		const { chart, commit } = createChart();

		await chart.updateFollowing('Example.com', false);

		expect(commit).toHaveBeenCalledWith({
			'following.total': -1,
			'following.inc': 0,
			'following.dec': 1,
		}, 'example.com');
	});

	test('updateFollowers increments counters when adding', async () => {
		const { chart, commit } = createChart();

		await chart.updateFollowers('Example.com', true);

		expect(commit).toHaveBeenCalledWith({
			'followers.total': 1,
			'followers.inc': 1,
			'followers.dec': 0,
		}, 'example.com');
	});

	test('updateFollowers decrements counters when removing', async () => {
		const { chart, commit } = createChart();

		await chart.updateFollowers('Example.com', false);

		expect(commit).toHaveBeenCalledWith({
			'followers.total': -1,
			'followers.inc': 0,
			'followers.dec': 1,
		}, 'example.com');
	});

	test('updateDrive increments counters when adding', async () => {
		const { chart, commit } = createChart();
		const file = { size: 5000, userHost: 'Example.com' } as DriveFile;

		await chart.updateDrive(file, true);

		expect(commit).toHaveBeenCalledWith({
			'drive.totalFiles': 1,
			'drive.incFiles': 1,
			'drive.incUsage': 5,
			'drive.decFiles': 1,
			'drive.decUsage': 5,
		}, 'Example.com');
	});

	test('updateDrive decrements counters when removing', async () => {
		const { chart, commit } = createChart();
		const file = { size: 3000, userHost: 'Example.com' } as DriveFile;

		await chart.updateDrive(file, false);

		expect(commit).toHaveBeenCalledWith({
			'drive.totalFiles': -1,
			'drive.incFiles': 0,
			'drive.incUsage': 0,
			'drive.decFiles': 0,
			'drive.decUsage': 0,
		}, 'Example.com');
	});
});
