process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import type { Redis } from 'ioredis';
import type { Config } from '@/config.js';

describe('GlobalEventService', () => {
	function createService() {
		const redisForPub = {
			publish: jest.fn(),
		} as unknown as jest.Mocked<Redis>;

		const config = { host: 'example.com' } as Config;

		const service = new GlobalEventService(config, redisForPub);

		return { service, redisForPub, config };
	}

	test('publishInternalEvent publishes to internal channel', () => {
		const { service, redisForPub } = createService();

		service.publishInternalEvent('userTokenRegenerated', { id: 'user1', oldToken: 'a', newToken: 'b' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'internal',
				message: {
					type: 'userTokenRegenerated',
					body: { id: 'user1', oldToken: 'a', newToken: 'b' },
				},
			}),
		);
	});

	test('publishInternalEvent uses null body when value omitted', () => {
		const { service, redisForPub } = createService();

		service.publishInternalEvent('userTokenRegenerated');

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'internal',
				message: {
					type: 'userTokenRegenerated',
					body: null,
				},
			}),
		);
	});

	test('publishBroadcastStream publishes to broadcast channel', () => {
		const { service, redisForPub } = createService();

		service.publishBroadcastStream('apiEndpoint', { endpoint: 'notes/create' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			expect.stringContaining('"channel":"broadcast"'),
		);
	});

	test('publishMainStream publishes to user-specific main channel', () => {
		const { service, redisForPub } = createService();

		service.publishMainStream('user1', 'meUpdated', { id: 'user1' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'mainStream:user1',
				message: { type: 'meUpdated', body: { id: 'user1' } },
			}),
		);
	});

	test('publishDriveStream publishes to user-specific drive channel', () => {
		const { service, redisForPub } = createService();

		service.publishDriveStream('user1', 'fileCreated');

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'driveStream:user1',
				message: { type: 'fileCreated', body: null },
			}),
		);
	});

	test('publishNoteStream wraps value with note id', () => {
		const { service, redisForPub } = createService();

		service.publishNoteStream('note1', 'reacted', { reaction: 'like' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'noteStream:note1',
				message: {
					type: 'reacted',
					body: {
						id: 'note1',
						body: { reaction: 'like' },
					},
				},
			}),
		);
	});

	test('publishUserListStream publishes to list channel', () => {
		const { service, redisForPub } = createService();

		service.publishUserListStream('list1', 'userAdded', { userId: 'user1' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			expect.stringContaining('"channel":"userListStream:list1"'),
		);
	});

	test('publishAntennaStream publishes to antenna channel', () => {
		const { service, redisForPub } = createService();

		service.publishAntennaStream('antenna1', 'note', { id: 'note1' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			expect.stringContaining('"channel":"antennaStream:antenna1"'),
		);
	});

	test('publishRoleTimelineStream publishes to role timeline channel', () => {
		const { service, redisForPub } = createService();

		service.publishRoleTimelineStream('role1', 'note', { id: 'note1' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			expect.stringContaining('"channel":"roleTimelineStream:role1"'),
		);
	});

	test('publishNotesStream publishes note to notesStream channel', () => {
		const { service, redisForPub } = createService();
		const note = { id: 'note1', text: 'hello' };

		service.publishNotesStream(note as any);

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'notesStream',
				message: note,
			}),
		);
	});

	test('publishAdminStream publishes to admin channel', () => {
		const { service, redisForPub } = createService();

		service.publishAdminStream('user1', 'newAbuseUserReport', { id: 'report1' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			expect.stringContaining('"channel":"adminStream:user1"'),
		);
	});

	test('publishMainStream with value includes body', () => {
		const { service, redisForPub } = createService();

		service.publishMainStream('user1', 'notification', { id: 'notif1' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'mainStream:user1',
				message: { type: 'notification', body: { id: 'notif1' } },
			}),
		);
	});

	test('publishBroadcastStream without value uses null body', () => {
		const { service, redisForPub } = createService();

		service.publishBroadcastStream('serverEvent');

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'broadcast',
				message: { type: 'serverEvent', body: null },
			}),
		);
	});

	test('publishDriveStream with value includes body', () => {
		const { service, redisForPub } = createService();

		service.publishDriveStream('user1', 'fileCreated', { id: 'file1' });

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'driveStream:user1',
				message: { type: 'fileCreated', body: { id: 'file1' } },
			}),
		);
	});

	test('publishUserListStream without value uses null body', () => {
		const { service, redisForPub } = createService();

		service.publishUserListStream('list1', 'userAdded');

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'userListStream:list1',
				message: { type: 'userAdded', body: null },
			}),
		);
	});

	test('publishAntennaStream without value uses null body', () => {
		const { service, redisForPub } = createService();

		service.publishAntennaStream('antenna1', 'note');

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'antennaStream:antenna1',
				message: { type: 'note', body: null },
			}),
		);
	});

	test('publishRoleTimelineStream without value uses null body', () => {
		const { service, redisForPub } = createService();

		service.publishRoleTimelineStream('role1', 'note');

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'roleTimelineStream:role1',
				message: { type: 'note', body: null },
			}),
		);
	});

	test('publishAdminStream without value uses null body', () => {
		const { service, redisForPub } = createService();

		service.publishAdminStream('user1', 'newAbuseUserReport');

		expect(redisForPub.publish).toHaveBeenCalledWith(
			'example.com',
			JSON.stringify({
				channel: 'adminStream:user1',
				message: { type: 'newAbuseUserReport', body: null },
			}),
		);
	});
});
