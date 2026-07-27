process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { QueueService } from '@/core/QueueService.js';
import type { Config } from '@/config.js';
import type { DbQueue, DeliverQueue, EndedPollNotificationQueue, InboxQueue, ObjectStorageQueue, RelationshipQueue, SystemQueue, WebhookDeliverQueue } from '@/core/QueueModule.js';
import type { ThinUser } from '@/queue/types.js';
import type { IActivity } from '@/core/activitypub/type.js';
import type { Webhook } from '@/models/entities/Webhook.js';

function createQueue() {
	const add = jest.fn().mockResolvedValue({ id: 'job1' });
	const addBulk = jest.fn().mockResolvedValue(undefined);
	const once = jest.fn();
	const clean = jest.fn().mockResolvedValue(undefined);

	const queue = { add, addBulk, once, clean } as unknown as any;

	const config = {
		deliverJobMaxAttempts: 8,
		inboxJobMaxAttempts: 4,
	} as unknown as Config;

	const service = new QueueService(
		config,
		queue as SystemQueue,
		queue as EndedPollNotificationQueue,
		queue as DeliverQueue,
		queue as InboxQueue,
		queue as DbQueue,
		queue as RelationshipQueue,
		queue as ObjectStorageQueue,
		queue as WebhookDeliverQueue,
	);

	return { service, queue };
}

function createUser(id = 'user1'): ThinUser {
	return { id } as ThinUser;
}

describe('QueueService', () => {
	test('deliver returns null when content is null', () => {
		const { service, queue } = createQueue();
		const result = service.deliver(createUser(), null, 'https://remote.example/inbox', false);
		expect(result).toBeNull();
		expect(queue.add).not.toHaveBeenCalled();
	});

	test('deliver returns null when to is null', () => {
		const { service, queue } = createQueue();
		const result = service.deliver(createUser(), { type: 'Note' } as IActivity, null, false);
		expect(result).toBeNull();
		expect(queue.add).not.toHaveBeenCalled();
	});

	test('deliver adds job with config attempts', () => {
		const { service, queue } = createQueue();
		const content = { type: 'Create' } as IActivity;
		service.deliver(createUser(), content, 'https://remote.example/inbox', true);
		expect(queue.add).toHaveBeenCalledWith(expect.objectContaining({ content, to: 'https://remote.example/inbox', isSharedInbox: true }), expect.objectContaining({ attempts: 8 }));
	});

	test('inbox adds job', () => {
		const { service, queue } = createQueue();
		const activity = { type: 'Create' } as IActivity;
		const signature = {} as any;
		service.inbox(activity, signature);
		expect(queue.add).toHaveBeenCalledWith(expect.objectContaining({ activity, signature }), expect.objectContaining({ attempts: 4 }));
	});

	test('createExportFollowingJob passes exclude flags', () => {
		const { service, queue } = createQueue();
		service.createExportFollowingJob(createUser(), true, true);
		expect(queue.add).toHaveBeenCalledWith('exportFollowing', expect.objectContaining({ excludeMuting: true, excludeInactive: true }), expect.any(Object));
	});

	test('createImportFollowingToDbJob uses addBulk', () => {
		const { service, queue } = createQueue();
		service.createImportFollowingToDbJob(createUser(), ['user2', 'user3']);
		expect(queue.addBulk).toHaveBeenCalledWith(expect.arrayContaining([
			expect.objectContaining({ name: 'importFollowingToDb', data: expect.objectContaining({ target: 'user2' }) }),
			expect.objectContaining({ name: 'importFollowingToDb', data: expect.objectContaining({ target: 'user3' }) }),
		]));
	});

	test('createImportBlockingToDbJob uses addBulk', () => {
		const { service, queue } = createQueue();
		service.createImportBlockingToDbJob(createUser(), ['user2']);
		expect(queue.addBulk).toHaveBeenCalledWith([expect.objectContaining({ name: 'importBlockingToDb', data: expect.objectContaining({ target: 'user2' }) })]);
	});

	test('createFollowJob adds bulk jobs with requestId and silent', () => {
		const { service, queue } = createQueue();
		service.createFollowJob([{ from: createUser('a'), to: createUser('b'), requestId: 'req1', silent: true }]);
		expect(queue.addBulk).toHaveBeenCalledWith([expect.objectContaining({
			name: 'follow',
			data: expect.objectContaining({ from: { id: 'a' }, to: { id: 'b' }, requestId: 'req1', silent: true }),
		})]);
	});

	test('createDelayedUnfollowJob passes delay option', () => {
		const { service, queue } = createQueue();
		service.createDelayedUnfollowJob([{ from: createUser('a'), to: createUser('b') }], 1000);
		expect(queue.addBulk).toHaveBeenCalledWith([expect.objectContaining({
			name: 'unfollow',
			opts: expect.objectContaining({ delay: 1000 }),
		})]);
	});

	test('createBlockJob adds bulk jobs', () => {
		const { service, queue } = createQueue();
		service.createBlockJob([{ from: createUser('a'), to: createUser('b'), silent: true }]);
		expect(queue.addBulk).toHaveBeenCalledWith([expect.objectContaining({ name: 'block' })]);
	});

	test('createUnblockJob adds bulk jobs', () => {
		const { service, queue } = createQueue();
		service.createUnblockJob([{ from: createUser('a'), to: createUser('b') }]);
		expect(queue.addBulk).toHaveBeenCalledWith([expect.objectContaining({ name: 'unblock' })]);
	});

	test('createDeleteObjectStorageFileJob adds deleteFile job', () => {
		const { service, queue } = createQueue();
		service.createDeleteObjectStorageFileJob('filekey');
		expect(queue.add).toHaveBeenCalledWith('deleteFile', { key: 'filekey' }, expect.any(Object));
	});

	test('createCleanRemoteFilesJob adds cleanRemoteFiles job', () => {
		const { service, queue } = createQueue();
		service.createCleanRemoteFilesJob();
		expect(queue.add).toHaveBeenCalledWith('cleanRemoteFiles', {}, expect.any(Object));
	});

	test('webhookDeliver adds job with webhook data', () => {
		const { service, queue } = createQueue();
		const webhook = { id: 'wh1', userId: 'user1', url: 'https://example.com/hook', secret: 'secret1' } as Webhook;
		service.webhookDeliver(webhook, 'mention', { id: 'note1' });
		expect(queue.add).toHaveBeenCalledWith(expect.objectContaining({
			webhookId: 'wh1',
			userId: 'user1',
			to: 'https://example.com/hook',
			secret: 'secret1',
			type: 'mention',
			content: { id: 'note1' },
		}), expect.any(Object));
	});

	test('destroy cleans deliver and inbox queues', () => {
		const { service, queue } = createQueue();
		service.destroy();
		expect(queue.once).toHaveBeenCalledTimes(2);
		expect(queue.clean).toHaveBeenCalledTimes(2);
		expect(queue.clean).toHaveBeenCalledWith(0, 'delayed');
	});

	test('createDeleteDriveFilesJob adds job', () => {
		const { service, queue } = createQueue();
		service.createDeleteDriveFilesJob(createUser());
		expect(queue.add).toHaveBeenCalledWith('deleteDriveFiles', expect.objectContaining({ user: { id: 'user1' } }), expect.any(Object));
	});

	test('createExportCustomEmojisJob adds job', () => {
		const { service, queue } = createQueue();
		service.createExportCustomEmojisJob(createUser());
		expect(queue.add).toHaveBeenCalledWith('exportCustomEmojis', expect.objectContaining({ user: { id: 'user1' } }), expect.any(Object));
	});

	test('createExportFavoritesJob adds job', () => {
		const { service, queue } = createQueue();
		service.createExportFavoritesJob(createUser());
		expect(queue.add).toHaveBeenCalledWith('exportFavorites', expect.objectContaining({ user: { id: 'user1' } }), expect.any(Object));
	});

	test('createExportMuteJob adds job', () => {
		const { service, queue } = createQueue();
		service.createExportMuteJob(createUser());
		expect(queue.add).toHaveBeenCalledWith('exportMuting', expect.objectContaining({ user: { id: 'user1' } }), expect.any(Object));
	});

	test('createExportBlockingJob adds job', () => {
		const { service, queue } = createQueue();
		service.createExportBlockingJob(createUser());
		expect(queue.add).toHaveBeenCalledWith('exportBlocking', expect.objectContaining({ user: { id: 'user1' } }), expect.any(Object));
	});

	test('createExportUserListsJob adds job', () => {
		const { service, queue } = createQueue();
		service.createExportUserListsJob(createUser());
		expect(queue.add).toHaveBeenCalledWith('exportUserLists', expect.objectContaining({ user: { id: 'user1' } }), expect.any(Object));
	});

	test('createExportAntennasJob adds job', () => {
		const { service, queue } = createQueue();
		service.createExportAntennasJob(createUser());
		expect(queue.add).toHaveBeenCalledWith('exportAntennas', expect.objectContaining({ user: { id: 'user1' } }), expect.any(Object));
	});

	test('createImportFollowingJob adds job', () => {
		const { service, queue } = createQueue();
		service.createImportFollowingJob(createUser(), 'file1');
		expect(queue.add).toHaveBeenCalledWith('importFollowing', expect.objectContaining({ user: { id: 'user1' }, fileId: 'file1' }), expect.any(Object));
	});

	test('createImportMutingJob adds job', () => {
		const { service, queue } = createQueue();
		service.createImportMutingJob(createUser(), 'file1');
		expect(queue.add).toHaveBeenCalledWith('importMuting', expect.objectContaining({ user: { id: 'user1' }, fileId: 'file1' }), expect.any(Object));
	});

	test('createImportBlockingJob adds job', () => {
		const { service, queue } = createQueue();
		service.createImportBlockingJob(createUser(), 'file1');
		expect(queue.add).toHaveBeenCalledWith('importBlocking', expect.objectContaining({ user: { id: 'user1' }, fileId: 'file1' }), expect.any(Object));
	});

	test('createImportUserListsJob adds job', () => {
		const { service, queue } = createQueue();
		service.createImportUserListsJob(createUser(), 'file1');
		expect(queue.add).toHaveBeenCalledWith('importUserLists', expect.objectContaining({ user: { id: 'user1' }, fileId: 'file1' }), expect.any(Object));
	});

	test('createImportCustomEmojisJob adds job', () => {
		const { service, queue } = createQueue();
		service.createImportCustomEmojisJob(createUser(), 'file1');
		expect(queue.add).toHaveBeenCalledWith('importCustomEmojis', expect.objectContaining({ user: { id: 'user1' }, fileId: 'file1' }), expect.any(Object));
	});

	test('createImportAntennasJob adds job', () => {
		const { service, queue } = createQueue();
		const antenna = { id: 'antenna1' } as any;
		service.createImportAntennasJob(createUser(), antenna);
		expect(queue.add).toHaveBeenCalledWith('importAntennas', expect.objectContaining({ user: { id: 'user1' }, antenna }), expect.any(Object));
	});

	test('createDeleteAccountJob adds job with soft flag', () => {
		const { service, queue } = createQueue();
		service.createDeleteAccountJob(createUser(), { soft: true });
		expect(queue.add).toHaveBeenCalledWith('deleteAccount', expect.objectContaining({ user: { id: 'user1' }, soft: true }), expect.any(Object));
	});

	test('createUnfollowJob adds bulk jobs', () => {
		const { service, queue } = createQueue();
		service.createUnfollowJob([{ from: createUser('a'), to: createUser('b') }]);
		expect(queue.addBulk).toHaveBeenCalledWith([expect.objectContaining({ name: 'unfollow' })]);
	});

	test('createUnblockJob adds bulk jobs', () => {
		const { service, queue } = createQueue();
		service.createUnblockJob([{ from: createUser('a'), to: createUser('b'), silent: true }]);
		expect(queue.addBulk).toHaveBeenCalledWith([expect.objectContaining({ name: 'unblock' })]);
	});
});
