process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { EmailService as EmailServiceType } from '@/core/EmailService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { Meta } from '@/models/entities/Meta.js';
import type { UserProfilesRepository } from '@/models/index.js';
import { MetaService } from '@/core/MetaService.js';
import { LoggerService } from '@/core/LoggerService.js';
import type { TestingModule } from '@nestjs/testing';

jest.unstable_mockModule('nodemailer', () => ({
	createTransport: jest.fn(),
}));

const { EmailService } = await import('@/core/EmailService.js');
const nodemailer = await import('nodemailer');

function createConfig(partial: Partial<Config> = {}): Config {
	return {
		url: 'https://example.com',
		host: 'example.com',
		hostname: 'example.com',
		scheme: 'https',
		wsScheme: 'wss',
		apiUrl: 'https://example.com/api',
		wsUrl: 'wss://example.com/streaming',
		authUrl: 'https://example.com/auth',
		driveUrl: 'https://example.com/files',
		userAgent: 'Test/1.0',
		clientEntry: '/client',
		clientManifestExists: false,
		mediaProxy: 'https://example.com/proxy',
		externalMediaProxyEnabled: false,
		videoThumbnailGenerator: null,
		redis: { host: 'localhost', port: 6379, pass: '' },
		redisForPubsub: { host: 'localhost', port: 6379, pass: '' },
		redisForJobQueue: { host: 'localhost', port: 6379, pass: '' },
		db: { host: 'localhost', port: 5432, db: 'misskey', user: 'misskey', pass: '' },
		id: 'aaaaaaaa',
		...partial,
	} as Config;
}

function createMeta(partial: Partial<Meta> = {}): Meta {
	return {
		id: 'x',
		blockedHosts: [],
		...partial,
	} as Meta;
}

function createMockLogger() {
	return {
		info: jest.fn(),
		succ: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		debug: jest.fn(),
		createSubLogger: jest.fn().mockReturnValue({
			info: jest.fn(),
			succ: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		}),
	};
}

function createMockTransporter(): jest.Mocked<Transporter<SMTPTransport.SentMessageInfo>> {
	return {
		sendMail: jest.fn().mockResolvedValue({ messageId: 'message-id-1' }),
	} as unknown as jest.Mocked<Transporter<SMTPTransport.SentMessageInfo>>;
}

describe('EmailService', () => {
	let app: TestingModule;
	let service: EmailServiceType;
	let metaService: jest.Mocked<MetaService>;
	let userProfilesRepository: jest.Mocked<UserProfilesRepository>;
	let loggerService: jest.Mocked<LoggerService>;
	let sendMail: jest.MockedFunction<Transporter<SMTPTransport.SentMessageInfo>['sendMail']>;

	beforeEach(async () => {
		sendMail = jest.fn().mockResolvedValue({ messageId: 'message-id-1' });
		(nodemailer.createTransport as jest.Mock).mockReturnValue({
			sendMail,
		} as unknown as Transporter<SMTPTransport.SentMessageInfo>);

		metaService = {
			fetch: jest.fn().mockResolvedValue(createMeta()),
			update: jest.fn(),
		} as unknown as jest.Mocked<MetaService>;

		userProfilesRepository = {
			countBy: jest.fn().mockResolvedValue(0),
		} as unknown as jest.Mocked<UserProfilesRepository>;

		loggerService = {
			getLogger: jest.fn().mockReturnValue(createMockLogger()),
		} as unknown as jest.Mocked<LoggerService>;

		app = await Test.createTestingModule({
			providers: [
				EmailService,
				{ provide: DI.config, useValue: createConfig() },
				{ provide: DI.userProfilesRepository, useValue: userProfilesRepository },
				{ provide: MetaService, useValue: metaService },
				{ provide: LoggerService, useValue: loggerService },
			],
		}).compile();

		service = app.get<EmailServiceType>(EmailService);
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	describe('sendEmail', () => {
		test('sends email without SMTP authentication', async () => {
			metaService.fetch.mockResolvedValue(createMeta({
				email: 'noreply@example.com',
				smtpHost: 'smtp.example.com',
				smtpPort: 587,
				smtpSecure: false,
				smtpUser: null,
				smtpPass: null,
				logoImageUrl: null,
				iconUrl: null,
			}));

			await service.sendEmail('user@example.com', 'Hello', '<p>Hello</p>', 'Hello text');

			expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
				host: 'smtp.example.com',
				port: 587,
				secure: false,
				ignoreTLS: true,
				auth: undefined,
			}));
			expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
				from: 'noreply@example.com',
				to: 'user@example.com',
				subject: 'Hello',
				text: 'Hello text',
				html: expect.stringContaining('<p>Hello</p>'),
			}));
		});

		test('sends email with SMTP authentication', async () => {
			metaService.fetch.mockResolvedValue(createMeta({
				email: 'noreply@example.com',
				smtpHost: 'smtp.example.com',
				smtpPort: 465,
				smtpSecure: true,
				smtpUser: 'smtpuser',
				smtpPass: 'smtppass',
				logoImageUrl: null,
				iconUrl: null,
			}));

			await service.sendEmail('user@example.com', 'Subject', '<b>Body</b>', 'Body');

			expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
				host: 'smtp.example.com',
				port: 465,
				secure: true,
				ignoreTLS: false,
				auth: {
					user: 'smtpuser',
					pass: 'smtppass',
				},
			}));
		});

		test('uses configured logo image URL in template', async () => {
			metaService.fetch.mockResolvedValue(createMeta({
				email: 'noreply@example.com',
				smtpHost: 'smtp.example.com',
				smtpPort: 587,
				smtpSecure: false,
				smtpUser: null,
				smtpPass: null,
				logoImageUrl: 'https://example.com/logo.png',
				iconUrl: null,
			}));

			await service.sendEmail('user@example.com', 'Logo test', '<p>content</p>', 'content');

			expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
				html: expect.stringContaining('https://example.com/logo.png'),
			}));
		});

		test('falls back to icon URL when logo image URL is not set', async () => {
			metaService.fetch.mockResolvedValue(createMeta({
				email: 'noreply@example.com',
				smtpHost: 'smtp.example.com',
				smtpPort: 587,
				smtpSecure: false,
				smtpUser: null,
				smtpPass: null,
				logoImageUrl: null,
				iconUrl: 'https://example.com/icon.png',
			}));

			await service.sendEmail('user@example.com', 'Icon test', '<p>content</p>', 'content');

			expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
				html: expect.stringContaining('https://example.com/icon.png'),
			}));
		});

		test('falls back to default white icon when no logo or icon is configured', async () => {
			metaService.fetch.mockResolvedValue(createMeta({
				email: 'noreply@example.com',
				smtpHost: 'smtp.example.com',
				smtpPort: 587,
				smtpSecure: false,
				smtpUser: null,
				smtpPass: null,
				logoImageUrl: null,
				iconUrl: null,
			}));

			await service.sendEmail('user@example.com', 'Fallback test', '<p>content</p>', 'content');

			expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
				html: expect.stringContaining('https://example.com/static-assets/mi-white.png'),
			}));
		});

		test('includes email settings link and host in template', async () => {
			metaService.fetch.mockResolvedValue(createMeta({
				email: 'noreply@example.com',
				smtpHost: 'smtp.example.com',
				smtpPort: 587,
				smtpSecure: false,
				smtpUser: null,
				smtpPass: null,
				logoImageUrl: null,
				iconUrl: null,
			}));

			await service.sendEmail('user@example.com', 'Links test', '<p>content</p>', 'content');

			expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
				html: expect.stringContaining('https://example.com/settings/email'),
				html: expect.stringContaining('https://example.com'),
				html: expect.stringContaining('example.com'),
			}));
		});

		test('logs error and rethrows when sending fails', async () => {
			const error = new Error('SMTP connection refused');
			sendMail.mockRejectedValue(error);

			metaService.fetch.mockResolvedValue(createMeta({
				email: 'noreply@example.com',
				smtpHost: 'smtp.example.com',
				smtpPort: 587,
				smtpSecure: false,
				smtpUser: null,
				smtpPass: null,
				logoImageUrl: null,
				iconUrl: null,
			}));

			await expect(service.sendEmail('user@example.com', 'Fail', '<p>fail</p>', 'fail')).rejects.toThrow('SMTP connection refused');
			expect(loggerService.getLogger('email').error).toHaveBeenCalled();
		});
	});

	describe('validateEmailForAccount', () => {
		test('returns available when email is unused and validation is disabled', async () => {
			metaService.fetch.mockResolvedValue(createMeta({ enableActiveEmailValidation: false }));
			userProfilesRepository.countBy.mockResolvedValue(0);

			const result = await service.validateEmailForAccount('new@example.com');

			expect(result).toEqual({ available: true, reason: null });
		});

		test('returns used when email is already verified', async () => {
			metaService.fetch.mockResolvedValue(createMeta({ enableActiveEmailValidation: false }));
			userProfilesRepository.countBy.mockResolvedValue(1);

			const result = await service.validateEmailForAccount('used@example.com');

			expect(result).toEqual({ available: false, reason: 'used' });
			expect(userProfilesRepository.countBy).toHaveBeenCalledWith({
				emailVerified: true,
				email: 'used@example.com',
			});
		});
	});
});
