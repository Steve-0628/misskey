process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { CaptchaService } from '@/core/CaptchaService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type { TestingModule } from '@nestjs/testing';

describe('CaptchaService', () => {
	let app: TestingModule;
	let captchaService: CaptchaService;
	let httpRequestService: jest.Mocked<HttpRequestService>;

	beforeEach(async () => {
		app = await Test.createTestingModule({
			providers: [
				CaptchaService,
				{
					provide: HttpRequestService,
					useValue: {
						send: jest.fn(),
					},
				},
			],
		}).compile();

		captchaService = app.get<CaptchaService>(CaptchaService);
		httpRequestService = app.get<HttpRequestService>(HttpRequestService) as jest.Mocked<HttpRequestService>;
	});

	afterEach(async () => {
		await app.close();
	});

	describe('verifyRecaptcha', () => {
		test('rejects when response is null', async () => {
			await expect(captchaService.verifyRecaptcha('secret', null)).rejects.toThrow('recaptcha-failed: no response provided');
		});

		test('rejects when response is undefined', async () => {
			await expect(captchaService.verifyRecaptcha('secret', undefined)).rejects.toThrow('recaptcha-failed: no response provided');
		});

		test('rejects when request fails', async () => {
			httpRequestService.send.mockRejectedValue(new Error('network error'));

			await expect(captchaService.verifyRecaptcha('secret', 'token')).rejects.toThrow('recaptcha-request-failed: Error: network error');
		});

		test('rejects when verification response is not ok', async () => {
			httpRequestService.send.mockResolvedValue({ ok: false, status: 500 } as Response);

			await expect(captchaService.verifyRecaptcha('secret', 'token')).rejects.toThrow('500');
		});

		test('rejects when success is false with error codes', async () => {
			httpRequestService.send.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ success: false, 'error-codes': ['invalid-input-response'] }),
			} as unknown as Response);

			await expect(captchaService.verifyRecaptcha('secret', 'token')).rejects.toThrow('recaptcha-failed: invalid-input-response');
		});

		test('rejects when success is false without error codes', async () => {
			httpRequestService.send.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ success: false }),
			} as unknown as Response);

			await expect(captchaService.verifyRecaptcha('secret', 'token')).rejects.toThrow('recaptcha-failed:');
		});

		test('resolves when verification succeeds', async () => {
			httpRequestService.send.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ success: true }),
			} as unknown as Response);

			await expect(captchaService.verifyRecaptcha('secret', 'token')).resolves.toBeUndefined();
		});
	});

	describe('verifyHcaptcha', () => {
		test('rejects when response is null', async () => {
			await expect(captchaService.verifyHcaptcha('secret', null)).rejects.toThrow('hcaptcha-failed: no response provided');
		});

		test('rejects when request fails', async () => {
			httpRequestService.send.mockRejectedValue(new Error('network error'));

			await expect(captchaService.verifyHcaptcha('secret', 'token')).rejects.toThrow('hcaptcha-request-failed: Error: network error');
		});

		test('rejects when verification response is not ok', async () => {
			httpRequestService.send.mockResolvedValue({ ok: false, status: 503 } as Response);

			await expect(captchaService.verifyHcaptcha('secret', 'token')).rejects.toThrow('503');
		});

		test('rejects when success is false', async () => {
			httpRequestService.send.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
			} as unknown as Response);

			await expect(captchaService.verifyHcaptcha('secret', 'token')).rejects.toThrow('hcaptcha-failed: timeout-or-duplicate');
		});

		test('resolves when verification succeeds', async () => {
			httpRequestService.send.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ success: true }),
			} as unknown as Response);

			await expect(captchaService.verifyHcaptcha('secret', 'token')).resolves.toBeUndefined();
		});
	});

	describe('verifyTurnstile', () => {
		test('rejects when response is null', async () => {
			await expect(captchaService.verifyTurnstile('secret', null)).rejects.toThrow('turnstile-failed: no response provided');
		});

		test('rejects when request fails', async () => {
			httpRequestService.send.mockRejectedValue(new Error('network error'));

			await expect(captchaService.verifyTurnstile('secret', 'token')).rejects.toThrow('turnstile-request-failed: Error: network error');
		});

		test('rejects when verification response is not ok', async () => {
			httpRequestService.send.mockResolvedValue({ ok: false, status: 400 } as Response);

			await expect(captchaService.verifyTurnstile('secret', 'token')).rejects.toThrow('400');
		});

		test('rejects when success is false', async () => {
			httpRequestService.send.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ success: false, 'error-codes': ['bad-request'] }),
			} as unknown as Response);

			await expect(captchaService.verifyTurnstile('secret', 'token')).rejects.toThrow('turnstile-failed: bad-request');
		});

		test('resolves when verification succeeds', async () => {
			httpRequestService.send.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ success: true }),
			} as unknown as Response);

			await expect(captchaService.verifyTurnstile('secret', 'token')).resolves.toBeUndefined();
		});
	});
});
