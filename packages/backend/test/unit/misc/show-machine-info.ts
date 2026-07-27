process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import sysUtils from 'systeminformation';
import Logger from '@/logger.js';
import { showMachineInfo } from '@/misc/show-machine-info.js';

describe('misc:show-machine-info', () => {
	let debugLogs: string[];
	let logger: Logger;

	beforeEach(() => {
		debugLogs = [];
		logger = new Logger('test');
		jest.spyOn(logger, 'createSubLogger').mockReturnValue({
			debug: (message: string) => {
				debugLogs.push(message);
			},
		} as unknown as Logger);

		jest.spyOn(sysUtils, 'mem').mockResolvedValue({
			total: 8 * 1024 * 1024 * 1024,
			available: 4 * 1024 * 1024 * 1024,
			active: 2 * 1024 * 1024 * 1024,
		} as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('logs hostname, platform, arch, cpu and memory', async () => {
		await showMachineInfo(logger);

		expect(debugLogs).toHaveLength(3);
		expect(debugLogs[0]).toMatch(/^Hostname: /);
		expect(debugLogs[1]).toBe(`Platform: ${process.platform} Arch: ${process.arch}`);
		expect(debugLogs[2]).toMatch(/^CPU: \d+ core MEM: [\d.]+GB \(available: [\d.]+GB\)$/);
	});
});
