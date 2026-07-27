process.env.NODE_ENV = 'test';

import * as crypto from 'node:crypto';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { TwoFactorAuthenticationService } from '@/core/TwoFactorAuthenticationService.js';
import { DI } from '@/di-symbols.js';
import type { UsersRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import type { TestingModule } from '@nestjs/testing';

function base64URLDecode(source: string): Buffer {
	return Buffer.from(source.replace(/\-/g, '+').replace(/_/g, '/'), 'base64');
}

function base64URLEncode(source: Buffer): string {
	return source.toString('base64url');
}

function generateKeyPair(): { rawPublicKey: Buffer; privateKeyPem: string } {
	const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
		namedCurve: 'prime256v1',
	});

	const jwk = publicKey.export({ format: 'jwk' });
	if (jwk.x == null || jwk.y == null) {
		throw new Error('failed to export public key');
	}

	const rawPublicKey = Buffer.concat([
		Buffer.from([0x04]),
		base64URLDecode(jwk.x),
		base64URLDecode(jwk.y),
	]);

	const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;

	return { rawPublicKey, privateKeyPem };
}

function createClientData(data: Partial<{ type: string; challenge: string; origin: string }> = {}): { json: Buffer; object: { type: string; challenge: string; origin: string } } {
	const object = {
		type: 'webauthn.get',
		challenge: 'test-challenge',
		origin: 'https://example.com',
		...data,
	};
	return { json: Buffer.from(JSON.stringify(object)), object };
}

describe('TwoFactorAuthenticationService', () => {
	let app: TestingModule;
	let service: TwoFactorAuthenticationService;

	beforeEach(async () => {
		const config = {
			scheme: 'https',
			host: 'example.com',
		} as unknown as Config;

		const usersRepository = {
			findOneBy: jest.fn(),
		} as unknown as jest.Mocked<UsersRepository>;

		app = await Test.createTestingModule({
			providers: [
				TwoFactorAuthenticationService,
				{ provide: DI.config, useValue: config },
				{ provide: DI.usersRepository, useValue: usersRepository },
			],
		}).compile();

		service = app.get<TwoFactorAuthenticationService>(TwoFactorAuthenticationService);
	});

	afterEach(async () => {
		await app.close();
	});

	describe('hash', () => {
		test('returns SHA-256 digest', () => {
			const data = Buffer.from('hello');
			const expected = crypto.createHash('sha256').update(data).digest();
			expect(service.hash(data)).toEqual(expected);
		});

		test('returns deterministic output', () => {
			const data = Buffer.from('world');
			expect(service.hash(data)).toEqual(service.hash(data));
		});
	});

	describe('verifySignin', () => {
		const { rawPublicKey, privateKeyPem } = generateKeyPair();
		const authenticatorData = crypto.randomBytes(37);

		test('returns true for a valid signature', () => {
			const { json: clientDataJSON, object: clientData } = createClientData();
			const challenge = service.hash(Buffer.from(clientData.challenge)).toString('hex');
			const verificationData = Buffer.concat([
				authenticatorData,
				service.hash(clientDataJSON),
			]);
			const signature = crypto.createSign('SHA256').update(verificationData).sign(privateKeyPem);

			expect(service.verifySignin({
				publicKey: rawPublicKey,
				authenticatorData,
				clientDataJSON,
				clientData,
				signature,
				challenge,
			})).toBe(true);
		});

		test('throws when clientData type is not webauthn.get', () => {
			const { json: clientDataJSON, object: clientData } = createClientData({ type: 'webauthn.create' });
			const challenge = service.hash(Buffer.from(clientData.challenge)).toString('hex');

			expect(() => service.verifySignin({
				publicKey: rawPublicKey,
				authenticatorData,
				clientDataJSON,
				clientData,
				signature: Buffer.alloc(0),
				challenge,
			})).toThrow('type is not webauthn.get');
		});

		test('throws when challenge does not match', () => {
			const { json: clientDataJSON, object: clientData } = createClientData();

			expect(() => service.verifySignin({
				publicKey: rawPublicKey,
				authenticatorData,
				clientDataJSON,
				clientData,
				signature: Buffer.alloc(0),
				challenge: 'deadbeef',
			})).toThrow('challenge mismatch');
		});

		test('throws when origin does not match config', () => {
			const { json: clientDataJSON, object: clientData } = createClientData({ origin: 'https://evil.example' });
			const challenge = service.hash(Buffer.from(clientData.challenge)).toString('hex');

			expect(() => service.verifySignin({
				publicKey: rawPublicKey,
				authenticatorData,
				clientDataJSON,
				clientData,
				signature: Buffer.alloc(0),
				challenge,
			})).toThrow('origin mismatch');
		});

		test('returns false for an invalid signature', () => {
			const { json: clientDataJSON, object: clientData } = createClientData();
			const challenge = service.hash(Buffer.from(clientData.challenge)).toString('hex');
			const signature = crypto.createSign('SHA256').update(Buffer.from('wrong-data')).sign(privateKeyPem);

			expect(service.verifySignin({
				publicKey: rawPublicKey,
				authenticatorData,
				clientDataJSON,
				clientData,
				signature,
				challenge,
			})).toBe(false);
		});
	});

	describe('getProcedures', () => {
		test('returns expected attestation procedures', () => {
			const procedures = service.getProcedures();
			expect(Object.keys(procedures).sort()).toEqual([
				'android-key',
				'android-safetynet',
				'fido-u2f',
				'none',
				'packed',
			]);
			for (const key of Object.keys(procedures)) {
				expect(typeof procedures[key as keyof typeof procedures].verify).toBe('function');
			}
		});

		describe('none', () => {
			test('returns a valid reconstructed public key', () => {
				const { rawPublicKey } = generateKeyPair();
				const map = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				const result = service.getProcedures().none.verify({ publicKey: map });
				expect(result.valid).toBe(true);
				expect(result.publicKey).toEqual(rawPublicKey);
			});

			test('throws when -2 key is missing', () => {
				const map = new Map<number, Buffer>([[-3, crypto.randomBytes(32)]]);
				expect(() => service.getProcedures().none.verify({ publicKey: map })).toThrow('invalid or no -2 key given');
			});

			test('throws when -2 key length is invalid', () => {
				const map = new Map<number, Buffer>([[-2, crypto.randomBytes(16)], [-3, crypto.randomBytes(32)]]);
				expect(() => service.getProcedures().none.verify({ publicKey: map })).toThrow('invalid or no -2 key given');
			});

			test('throws when -3 key length is invalid', () => {
				const map = new Map<number, Buffer>([[-2, crypto.randomBytes(32)], [-3, crypto.randomBytes(16)]]);
				expect(() => service.getProcedures().none.verify({ publicKey: map })).toThrow('invalid or no -3 key given');
			});
		});

		describe('android-key', () => {
			const { rawPublicKey, privateKeyPem } = generateKeyPair();
			const authenticatorData = crypto.randomBytes(37);
			const clientDataHash = crypto.randomBytes(32);
			const rpIdHash = crypto.randomBytes(32);
			const credentialId = crypto.randomBytes(16);

			function createAttStmt(overrides: Partial<{ alg: number; x5c: Buffer[]; sig: Buffer }> = {}) {
				const verificationData = Buffer.concat([authenticatorData, clientDataHash]);
				return {
					alg: -7,
					x5c: [rawPublicKey],
					sig: crypto.createSign('SHA256').update(verificationData).sign(privateKeyPem),
					...overrides,
				};
			}

			test('returns valid when attestation is valid', () => {
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				const result = service.getProcedures()['android-key'].verify({
					attStmt: createAttStmt(),
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				});
				expect(result.valid).toBe(true);
				expect(result.publicKey).toEqual(rawPublicKey);
			});

			test('throws when alg is not -7', () => {
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				expect(() => service.getProcedures()['android-key'].verify({
					attStmt: createAttStmt({ alg: -8 }),
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				})).toThrow('alg mismatch');
			});

			test('throws when public key in x5c does not match reconstructed key', () => {
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				expect(() => service.getProcedures()['android-key'].verify({
					attStmt: createAttStmt({ x5c: [crypto.randomBytes(65)] }),
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				})).toThrow('public key mismatch');
			});

			test('throws when reconstructed -2 key length is invalid', () => {
				const publicKey = new Map<number, Buffer>([[-2, crypto.randomBytes(16)], [-3, rawPublicKey.subarray(33, 65)]]);
				expect(() => service.getProcedures()['android-key'].verify({
					attStmt: createAttStmt(),
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				})).toThrow('invalid or no -2 key given');
			});
		});

		describe('packed', () => {
			const { rawPublicKey, privateKeyPem } = generateKeyPair();
			const authenticatorData = crypto.randomBytes(37);
			const clientDataHash = crypto.randomBytes(32);
			const rpIdHash = crypto.randomBytes(32);
			const credentialId = crypto.randomBytes(16);

			test('returns valid with a valid x5c attestation', () => {
				const verificationData = Buffer.concat([authenticatorData, clientDataHash]);
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				const attStmt = {
					x5c: [rawPublicKey],
					sig: crypto.createSign('SHA256').update(verificationData).sign(privateKeyPem),
				};
				const result = service.getProcedures().packed.verify({
					attStmt,
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				});
				expect(result.valid).toBe(true);
				expect(result.publicKey).toEqual(rawPublicKey);
			});

			test('throws when ECDAA is used', () => {
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				expect(() => service.getProcedures().packed.verify({
					attStmt: { ecdaaKeyId: crypto.randomBytes(8) },
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				})).toThrow('ECDAA-Verify is not supported');
			});

			test('throws when alg does not match for self attestation', () => {
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				expect(() => service.getProcedures().packed.verify({
					attStmt: { alg: -8 },
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				})).toThrow('alg mismatch');
			});

			test('throws because self attestation is not supported', () => {
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				expect(() => service.getProcedures().packed.verify({
					attStmt: { alg: -7 },
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				})).toThrow('self attestation is not supported');
			});
		});

		describe('fido-u2f', () => {
			const { rawPublicKey, privateKeyPem } = generateKeyPair();
			const authenticatorData = crypto.randomBytes(37);
			const clientDataHash = crypto.randomBytes(32);
			const rpIdHash = crypto.randomBytes(32);
			const credentialId = crypto.randomBytes(16);

			test('returns valid with a valid attestation', () => {
				const publicKeyU2F = rawPublicKey;
				const verificationData = Buffer.concat([
					Buffer.from([0]),
					rpIdHash,
					clientDataHash,
					credentialId,
					publicKeyU2F,
				]);
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				const attStmt = {
					x5c: [rawPublicKey],
					sig: crypto.createSign('SHA256').update(verificationData).sign(privateKeyPem),
				};
				const result = service.getProcedures()['fido-u2f'].verify({
					attStmt,
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				});
				expect(result.valid).toBe(true);
				expect(result.publicKey).toEqual(rawPublicKey);
			});

			test('throws when x5c length is not 1', () => {
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				expect(() => service.getProcedures()['fido-u2f'].verify({
					attStmt: { x5c: [] },
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				})).toThrow('x5c length does not match expectation');
			});

			test('throws when reconstructed -3 key length is invalid', () => {
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, crypto.randomBytes(16)]]);
				expect(() => service.getProcedures()['fido-u2f'].verify({
					attStmt: { x5c: [rawPublicKey] },
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				})).toThrow('invalid or no -3 key given');
			});
		});

		describe('android-safetynet', () => {
			const { rawPublicKey } = generateKeyPair();
			const authenticatorData = crypto.randomBytes(37);
			const clientDataHash = crypto.randomBytes(32);
			const rpIdHash = crypto.randomBytes(32);
			const credentialId = crypto.randomBytes(16);

			function createJws(header: object, payload: object, signature: Buffer): Buffer {
				const encoded = `${base64URLEncode(Buffer.from(JSON.stringify(header)))}.${base64URLEncode(Buffer.from(JSON.stringify(payload)))}.${base64URLEncode(signature)}`;
				return Buffer.from(encoded, 'utf-8');
			}

			test('throws when nonce does not match', () => {
				const publicKey = new Map<number, Buffer>([[-2, rawPublicKey.subarray(1, 33)], [-3, rawPublicKey.subarray(33, 65)]]);
				const header = { x5c: [rawPublicKey] };
				const payload = { nonce: base64URLEncode(Buffer.from('invalid')) };
				const response = createJws(header, payload, crypto.randomBytes(32));

				expect(() => service.getProcedures()['android-safetynet'].verify({
					attStmt: { response },
					authenticatorData,
					clientDataHash,
					publicKey,
					rpIdHash,
					credentialId,
				})).toThrow('invalid nonce');
			});
		});
	});
});
