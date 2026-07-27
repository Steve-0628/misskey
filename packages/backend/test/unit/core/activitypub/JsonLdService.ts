process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { JsonLdService } from '@/core/activitypub/JsonLdService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type { TestingModule } from '@nestjs/testing';
import type { JsonLdDocument } from 'jsonld';

describe('JsonLdService', () => {
	let app: TestingModule;
	let service: JsonLdService;
	let httpRequestService: jest.Mocked<HttpRequestService>;

	beforeEach(async () => {
		httpRequestService = {
			send: jest.fn().mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({}),
			} as unknown as Response),
			getJson: jest.fn(),
		} as unknown as jest.Mocked<HttpRequestService>;

		app = await Test.createTestingModule({
			providers: [
				JsonLdService,
				{ provide: HttpRequestService, useValue: httpRequestService },
			],
		}).compile();

		service = app.get<JsonLdService>(JsonLdService);
	});

	afterEach(async () => {
		await app.close();
	});

	describe('use', () => {
		test('returns a JsonLd instance with public methods', () => {
			const jsonLd = service.use();

			expect(jsonLd).toBeDefined();
			expect(typeof jsonLd.compact).toBe('function');
			expect(typeof jsonLd.normalize).toBe('function');
			expect(typeof jsonLd.signRsaSignature2017).toBe('function');
			expect(typeof jsonLd.verifyRsaSignature2017).toBe('function');
			expect(typeof jsonLd.sha256).toBe('function');
		});
	});

	describe('compact', () => {
		test('compacts a simple object with default context', async () => {
			const jsonLd = service.use();
			const data = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				type: 'Note',
				id: 'https://example.com/notes/1',
				content: 'hello',
			};

			const result = await jsonLd.compact(data);

			expect(result).toBeDefined();
			expect((result as JsonLdDocument)['type']).toContain('Note');
		});

		test('compacts an object with custom context', async () => {
			const jsonLd = service.use();
			const data = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				type: 'Note',
				id: 'https://example.com/notes/1',
			};
			const context = { Note: 'https://www.w3.org/ns/activitystreams#Note' };

			const result = await jsonLd.compact(data, context);

			expect(result).toBeDefined();
		});
	});

	describe('normalize', () => {
		test('normalizes a document', async () => {
			const jsonLd = service.use();
			const data = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				type: 'Note',
				id: 'https://example.com/notes/1',
			};

			const result = await jsonLd.normalize(data as JsonLdDocument);

			expect(typeof result).toBe('string');
		});
	});

	describe('signRsaSignature2017', () => {
		test('signs data and returns a signature object', async () => {
			const { generateKeyPairSync } = await import('node:crypto');
			const { privateKey } = generateKeyPairSync('rsa', {
				modulusLength: 2048,
				publicKeyEncoding: { type: 'spki', format: 'pem' },
				privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
			});

			const jsonLd = service.use();
			const data = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				type: 'Note',
				id: 'https://example.com/notes/1',
			};

			const result = await jsonLd.signRsaSignature2017(data, privateKey, 'https://example.com/users/1#main-key');

			expect(result.signature).toBeDefined();
			expect(result.signature.type).toBe('RsaSignature2017');
			expect(result.signature.creator).toBe('https://example.com/users/1#main-key');
			expect(result.signature.signatureValue).toBeDefined();
		});
	});

	describe('verifyRsaSignature2017', () => {
		test('verifies a valid signature', async () => {
			const { generateKeyPairSync } = await import('node:crypto');
			const { privateKey, publicKey } = generateKeyPairSync('rsa', {
				modulusLength: 2048,
				publicKeyEncoding: { type: 'spki', format: 'pem' },
				privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
			});

			const jsonLd = service.use();
			const data = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				type: 'Note',
				id: 'https://example.com/notes/1',
			};

			const signed = await jsonLd.signRsaSignature2017(data, privateKey, 'https://example.com/users/1#main-key');
			const verified = await jsonLd.verifyRsaSignature2017(signed, publicKey);

			expect(verified).toBe(true);
		});

		test('rejects an invalid signature', async () => {
			const { generateKeyPairSync } = await import('node:crypto');
			const { privateKey } = generateKeyPairSync('rsa', {
				modulusLength: 2048,
				publicKeyEncoding: { type: 'spki', format: 'pem' },
				privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
			});
			const { publicKey: otherPublicKey } = generateKeyPairSync('rsa', {
				modulusLength: 2048,
				publicKeyEncoding: { type: 'spki', format: 'pem' },
				privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
			});

			const jsonLd = service.use();
			const data = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				type: 'Note',
				id: 'https://example.com/notes/1',
			};

			const signed = await jsonLd.signRsaSignature2017(data, privateKey, 'https://example.com/users/1#main-key');
			const verified = await jsonLd.verifyRsaSignature2017(signed, otherPublicKey);

			expect(verified).toBe(false);
		});
	});

	describe('getLoader', () => {
		test('uses preloaded contexts without network calls', async () => {
			const jsonLd = service.use();
			const data = {
				'@context': 'https://www.w3.org/ns/activitystreams',
				type: 'Note',
				id: 'https://example.com/notes/1',
			};

			await jsonLd.compact(data);

			expect(httpRequestService.send).not.toHaveBeenCalled();
		});

		test('fetches unknown contexts from network', async () => {
			const jsonLd = service.use();
			httpRequestService.send.mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({
					'@context': {
						CustomType: 'https://example.com/ns#CustomType',
					},
				}),
			} as unknown as Response);

			const data = {
				'@context': 'https://example.com/ns/custom',
				type: 'CustomType',
				id: 'https://example.com/notes/1',
			};

			await jsonLd.compact(data);

			expect(httpRequestService.send).toHaveBeenCalled();
		});
	});
});
