process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { ImageProcessingService } from '@/core/ImageProcessingService.js';
import type { Config } from '@/config.js';
import sharp from 'sharp';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function createSharpFromSvg(width = 100, height = 100): sharp.Sharp {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
	return sharp(Buffer.from(svg));
}

function createTempImageFile(ext: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'imgproc-'));
	const path = join(dir, `image.${ext}`);
	const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';
	writeFileSync(path, svg);
	return path;
}

describe('ImageProcessingService', () => {
	const service = new ImageProcessingService({} as Config);

	test('convertToWebp returns converted image', async () => {
		const path = createTempImageFile('png');
		const result = await service.convertToWebp(path, 64, 64);
		expect(result.ext).toBe('webp');
		expect(result.type).toBe('image/webp');
		expect(result.data.length).toBeGreaterThan(0);
		rmSync(path, { recursive: true, force: true });
	});

	test('convertSharpToWebp returns converted image', async () => {
		const result = await service.convertSharpToWebp(createSharpFromSvg(), 64, 64);
		expect(result.ext).toBe('webp');
		expect(result.data.length).toBeGreaterThan(0);
	});

	test('convertToWebpStream returns sharp stream', async () => {
		const path = createTempImageFile('png');
		const result = service.convertToWebpStream(path, 64, 64);
		expect(result.ext).toBe('webp');
		expect(result.type).toBe('image/webp');
		expect(result.data).toBeDefined();
		rmSync(path, { recursive: true, force: true });
	});

	test('convertToAvif returns converted image', async () => {
		const path = createTempImageFile('png');
		const result = await service.convertToAvif(path, 64, 64);
		expect(result.ext).toBe('avif');
		expect(result.type).toBe('image/avif');
		expect(result.data.length).toBeGreaterThan(0);
		rmSync(path, { recursive: true, force: true });
	});

	test('convertSharpToAvif returns converted image', async () => {
		const result = await service.convertSharpToAvif(createSharpFromSvg(), 64, 64);
		expect(result.ext).toBe('avif');
		expect(result.data.length).toBeGreaterThan(0);
	});

	test('convertToAvifStream returns sharp stream', async () => {
		const path = createTempImageFile('png');
		const result = service.convertToAvifStream(path, 64, 64);
		expect(result.ext).toBe('avif');
		expect(result.type).toBe('image/avif');
		expect(result.data).toBeDefined();
		rmSync(path, { recursive: true, force: true });
	});

	test('convertToPng returns converted image', async () => {
		const path = createTempImageFile('jpg');
		const result = await service.convertToPng(path, 64, 64);
		expect(result.ext).toBe('png');
		expect(result.type).toBe('image/png');
		expect(result.data.length).toBeGreaterThan(0);
		rmSync(path, { recursive: true, force: true });
	});

	test('convertSharpToPng returns converted image', async () => {
		const result = await service.convertSharpToPng(createSharpFromSvg(), 64, 64);
		expect(result.ext).toBe('png');
		expect(result.data.length).toBeGreaterThan(0);
	});

	test('convertToWebp with custom options', async () => {
		const path = createTempImageFile('png');
		const result = await service.convertToWebp(path, 64, 64, { quality: 50, alphaQuality: 80, lossless: false, nearLossless: false, smartSubsample: false, mixed: false, effort: 0 });
		expect(result.ext).toBe('webp');
		expect(result.data.length).toBeGreaterThan(0);
		rmSync(path, { recursive: true, force: true });
	});

	test('convertToAvif with custom options', async () => {
		const path = createTempImageFile('png');
		const result = await service.convertToAvif(path, 64, 64, { quality: 40, lossless: false, effort: 0 });
		expect(result.ext).toBe('avif');
		expect(result.data.length).toBeGreaterThan(0);
		rmSync(path, { recursive: true, force: true });
	});

	test('convertToWebpStream with custom options', async () => {
		const path = createTempImageFile('png');
		const result = service.convertToWebpStream(path, 64, 64, { quality: 50 });
		expect(result.ext).toBe('webp');
		expect(result.data).toBeDefined();
		rmSync(path, { recursive: true, force: true });
	});

	test('convertToAvifStream with custom options', async () => {
		const path = createTempImageFile('png');
		const result = service.convertToAvifStream(path, 64, 64, { quality: 40 });
		expect(result.ext).toBe('avif');
		expect(result.data).toBeDefined();
		rmSync(path, { recursive: true, force: true });
	});

	test('convertSharpToWebpStream without options uses defaults', async () => {
		const result = service.convertSharpToWebpStream(createSharpFromSvg(), 64, 64);
		expect(result.ext).toBe('webp');
		expect(result.type).toBe('image/webp');
		expect(result.data).toBeDefined();
	});

	test('convertSharpToAvifStream without options uses defaults', async () => {
		const result = service.convertSharpToAvifStream(createSharpFromSvg(), 64, 64);
		expect(result.ext).toBe('avif');
		expect(result.type).toBe('image/avif');
		expect(result.data).toBeDefined();
	});
});
