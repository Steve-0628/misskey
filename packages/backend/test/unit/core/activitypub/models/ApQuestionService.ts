process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { ApQuestionService } from '@/core/activitypub/models/ApQuestionService.js';
import type { Config } from '@/config.js';
import type { NotesRepository, PollsRepository } from '@/models/index.js';
import type { ApLoggerService } from '@/core/activitypub/ApLoggerService.js';
import type { ApResolverService } from '@/core/activitypub/ApResolverService.js';
import type Logger from '@/logger.js';
import type { IPoll } from '@/models/entities/Poll.js';

function createService() {
	const config = { url: 'https://example.com' } as Config;
	const notesRepository = {
		findOneBy: jest.fn(),
	} as unknown as jest.Mocked<NotesRepository>;
	const pollsRepository = {
		findOneBy: jest.fn(),
		update: jest.fn().mockResolvedValue(undefined),
	} as unknown as jest.Mocked<PollsRepository>;
	const logger = {
		debug: jest.fn(),
	} as unknown as Logger;
	const apLoggerService = {
		logger,
	} as unknown as ApLoggerService;
	const resolver = {
		resolve: jest.fn(),
	};
	const apResolverService = {
		createResolver: jest.fn().mockReturnValue(resolver),
	} as unknown as jest.Mocked<ApResolverService>;

	const service = new ApQuestionService(
		config,
		notesRepository,
		pollsRepository,
		apResolverService,
		apLoggerService,
	);

	return {
		service,
		mocks: {
			config,
			notesRepository,
			pollsRepository,
			apResolverService,
			resolver,
			logger,
		},
	};
}

describe('ApQuestionService', () => {
	describe('extractPollFromQuestion', () => {
		test('throws if resolved object is not a Question', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({ type: 'Unknown' });

			await expect(service.extractPollFromQuestion('https://remote/question/1')).rejects.toThrow('invalid type');
		});

		test('throws if neither oneOf nor anyOf is present', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({ type: 'Question' });

			await expect(service.extractPollFromQuestion('https://remote/question/1')).rejects.toThrow('invalid question');
		});

		test('extracts single-choice poll from oneOf', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({
				type: 'Question',
				oneOf: [
					{ type: 'Note', name: 'A' },
					{ type: 'Note', name: 'B' },
				],
				endTime: '2026-01-01T00:00:00Z',
			});

			const result = await service.extractPollFromQuestion('https://remote/question/1');

			expect(result.multiple).toBe(false);
			expect(result.choices).toEqual(['A', 'B']);
			expect(result.expiresAt).toEqual(new Date('2026-01-01T00:00:00Z'));
		});

		test('extracts multiple-choice poll from anyOf', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({
				type: 'Question',
				anyOf: [
					{ type: 'Note', name: 'A', replies: { totalItems: 5 } },
					{ type: 'Note', name: 'B', _misskey_votes: 3 },
				],
				closed: '2026-02-01T00:00:00Z',
			});

			const result = await service.extractPollFromQuestion('https://remote/question/1');

			expect(result.multiple).toBe(true);
			expect(result.choices).toEqual(['A', 'B']);
			expect(result.votes).toEqual([5, 3]);
			expect(result.expiresAt).toEqual(new Date('2026-02-01T00:00:00Z'));
		});

		test('falls back to _misskey_votes when replies.totalItems is missing', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({
				type: 'Question',
				oneOf: [
					{ type: 'Note', name: 'A', _misskey_votes: 7 },
				],
			});

			const result = await service.extractPollFromQuestion('https://remote/question/1');

			expect(result.votes).toEqual([7]);
		});

		test('defaults votes to zero when neither replies nor _misskey_votes exist', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({
				type: 'Question',
				oneOf: [
					{ type: 'Note', name: 'A' },
				],
			});

			const result = await service.extractPollFromQuestion('https://remote/question/1');

			expect(result.votes).toEqual([0]);
		});

		test('filters out non-string choice names', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({
				type: 'Question',
				oneOf: [
					{ type: 'Note', name: 'A' },
					{ type: 'Note', name: 123 },
				],
			});

			const result = await service.extractPollFromQuestion('https://remote/question/1');

			expect(result.choices).toEqual(['A']);
		});

		test('returns null expiry when neither endTime nor closed is set', async () => {
			const { service, mocks } = createService();
			mocks.resolver.resolve.mockResolvedValue({
				type: 'Question',
				oneOf: [
					{ type: 'Note', name: 'A' },
				],
			});

			const result = await service.extractPollFromQuestion('https://remote/question/1');

			expect(result.expiresAt).toBeNull();
		});
	});

	describe('updateQuestion', () => {
		test('throws when value object has no id', async () => {
			const { service } = createService();

			await expect(service.updateQuestion({ type: 'Question' } as any)).rejects.toThrow('uri is null');
		});

		test('throws when uri points to local instance', async () => {
			const { service } = createService();

			await expect(service.updateQuestion('https://example.com/question/1')).rejects.toThrow('uri points local');
		});

		test('throws when note is not registered locally', async () => {
			const { service, mocks } = createService();
			mocks.notesRepository.findOneBy.mockResolvedValue(null);

			await expect(service.updateQuestion('https://remote/question/1')).rejects.toThrow('Question is not registed');
		});

		test('throws when poll is not registered locally', async () => {
			const { service, mocks } = createService();
			mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'note1' });
			mocks.pollsRepository.findOneBy.mockResolvedValue(null);

			await expect(service.updateQuestion('https://remote/question/1')).rejects.toThrow('Question is not registed');
		});

		test('throws when resolved object is not a Question', async () => {
			const { service, mocks } = createService();
			mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'note1' });
			mocks.pollsRepository.findOneBy.mockResolvedValue({
				noteId: 'note1',
				choices: ['A'],
				votes: [0],
			} as unknown as IPoll);
			mocks.resolver.resolve.mockResolvedValue({ type: 'Note' });

			await expect(service.updateQuestion('https://remote/question/1')).rejects.toThrow('object is not a Question');
		});

		test('throws when apChoices is missing', async () => {
			const { service, mocks } = createService();
			mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'note1' });
			mocks.pollsRepository.findOneBy.mockResolvedValue({
				noteId: 'note1',
				choices: ['A'],
				votes: [0],
			} as unknown as IPoll);
			mocks.resolver.resolve.mockResolvedValue({ type: 'Question' });

			await expect(service.updateQuestion('https://remote/question/1')).rejects.toThrow('invalid apChoices: undefined');
		});

		test('throws when new count cannot be determined', async () => {
			const { service, mocks } = createService();
			mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'note1' });
			mocks.pollsRepository.findOneBy.mockResolvedValue({
				noteId: 'note1',
				choices: ['A'],
				votes: [0],
			} as unknown as IPoll);
			mocks.resolver.resolve.mockResolvedValue({
				type: 'Question',
				oneOf: [{ type: 'Note', name: 'A' }],
			});

			await expect(service.updateQuestion('https://remote/question/1')).rejects.toThrow('invalid newCount: undefined');
		});

		test('returns false and updates nothing when vote counts are unchanged', async () => {
			const { service, mocks } = createService();
			mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'note1' });
			mocks.pollsRepository.findOneBy.mockResolvedValue({
				noteId: 'note1',
				choices: ['A'],
				votes: [5],
			} as unknown as IPoll);
			mocks.resolver.resolve.mockResolvedValue({
				type: 'Question',
				oneOf: [{ type: 'Note', name: 'A', replies: { totalItems: 5 } }],
			});

			const changed = await service.updateQuestion('https://remote/question/1');

			expect(changed).toBe(false);
			expect(mocks.pollsRepository.update).toHaveBeenCalledWith(
				{ noteId: 'note1' },
				{ votes: [5] },
			);
		});

		test('returns true and updates votes when counts changed', async () => {
			const { service, mocks } = createService();
			mocks.notesRepository.findOneBy.mockResolvedValue({ id: 'note1' });
			mocks.pollsRepository.findOneBy.mockResolvedValue({
				noteId: 'note1',
				choices: ['A'],
				votes: [3],
			} as unknown as IPoll);
			mocks.resolver.resolve.mockResolvedValue({
				type: 'Question',
				oneOf: [{ type: 'Note', name: 'A', replies: { totalItems: 8 } }],
			});

			const changed = await service.updateQuestion('https://remote/question/1');

			expect(changed).toBe(true);
			expect(mocks.pollsRepository.update).toHaveBeenCalledWith(
				{ noteId: 'note1' },
				{ votes: [8] },
			);
		});
	});
});
