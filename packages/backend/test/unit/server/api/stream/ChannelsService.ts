process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';
import { describe, test, expect } from '@jest/globals';
import { ChannelsService } from '@/server/api/stream/ChannelsService.js';
import type { MainChannelService } from '@/server/api/stream/channels/main.js';
import type { HomeTimelineChannelService } from '@/server/api/stream/channels/home-timeline.js';
import type { LocalTimelineChannelService } from '@/server/api/stream/channels/local-timeline.js';
import type { GlobalTimelineChannelService } from '@/server/api/stream/channels/global-timeline.js';
import type { HybridTimelineChannelService } from '@/server/api/stream/channels/hybrid-timeline.js';
import type { UserListChannelService } from '@/server/api/stream/channels/user-list.js';
import type { AntennaChannelService } from '@/server/api/stream/channels/antenna.js';
import type { DriveChannelService } from '@/server/api/stream/channels/drive.js';
import type { HashtagChannelService } from '@/server/api/stream/channels/hashtag.js';
import type { ServerStatsChannelService } from '@/server/api/stream/channels/server-stats.js';
import type { QueueStatsChannelService } from '@/server/api/stream/channels/queue-stats.js';
import type { RoleTimelineChannelService } from '@/server/api/stream/channels/role-timeline.js';
import type { AdminChannelService } from '@/server/api/stream/channels/admin.js';

describe('ChannelsService', () => {
	function createService(): {
		service: ChannelsService;
		mocks: Record<string, unknown>;
	} {
		const mocks: Record<string, unknown> = {
			mainChannelService: {},
			homeTimelineChannelService: {},
			localTimelineChannelService: {},
			hybridTimelineChannelService: {},
			globalTimelineChannelService: {},
			userListChannelService: {},
			hashtagChannelService: {},
			roleTimelineChannelService: {},
			antennaChannelService: {},
			driveChannelService: {},
			serverStatsChannelService: {},
			queueStatsChannelService: {},
			adminChannelService: {},
		};

		const service = new ChannelsService(
			mocks.mainChannelService as MainChannelService,
			mocks.homeTimelineChannelService as HomeTimelineChannelService,
			mocks.localTimelineChannelService as LocalTimelineChannelService,
			mocks.hybridTimelineChannelService as HybridTimelineChannelService,
			mocks.globalTimelineChannelService as GlobalTimelineChannelService,
			mocks.userListChannelService as UserListChannelService,
			mocks.hashtagChannelService as HashtagChannelService,
			mocks.roleTimelineChannelService as RoleTimelineChannelService,
			mocks.antennaChannelService as AntennaChannelService,
			mocks.driveChannelService as DriveChannelService,
			mocks.serverStatsChannelService as ServerStatsChannelService,
			mocks.queueStatsChannelService as QueueStatsChannelService,
			mocks.adminChannelService as AdminChannelService,
		);

		return { service, mocks };
	}

	test('returns the correct service for each channel name', () => {
		const { service, mocks } = createService();

		expect(service.getChannelService('main')).toBe(mocks.mainChannelService);
		expect(service.getChannelService('homeTimeline')).toBe(mocks.homeTimelineChannelService);
		expect(service.getChannelService('localTimeline')).toBe(mocks.localTimelineChannelService);
		expect(service.getChannelService('hybridTimeline')).toBe(mocks.hybridTimelineChannelService);
		expect(service.getChannelService('globalTimeline')).toBe(mocks.globalTimelineChannelService);
		expect(service.getChannelService('userList')).toBe(mocks.userListChannelService);
		expect(service.getChannelService('hashtag')).toBe(mocks.hashtagChannelService);
		expect(service.getChannelService('roleTimeline')).toBe(mocks.roleTimelineChannelService);
		expect(service.getChannelService('antenna')).toBe(mocks.antennaChannelService);
		expect(service.getChannelService('drive')).toBe(mocks.driveChannelService);
		expect(service.getChannelService('serverStats')).toBe(mocks.serverStatsChannelService);
		expect(service.getChannelService('queueStats')).toBe(mocks.queueStatsChannelService);
		expect(service.getChannelService('admin')).toBe(mocks.adminChannelService);
	});

	test('throws when given an unknown channel name', () => {
		const { service } = createService();

		expect(() => service.getChannelService('unknownChannel')).toThrow('no such channel: unknownChannel');
	});
});
