import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { FollowingsRepository, InstancesRepository } from '@/models/index.js';
import { AppLockService } from '@/core/AppLockService.js';
import { DI } from '@/di-symbols.js';
import { MetaService } from '@/core/MetaService.js';
import { bindThis } from '@/decorators.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/federation.js';
import type { KVs } from '../core.js';

/**
 * フェデレーションに関するチャート
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class FederationChart extends Chart<typeof schema> {
	constructor(
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		private metaService: MetaService,
		private appLockService: AppLockService,
		private chartLoggerService: ChartLoggerService,
	) {
		super(db, (k) => appLockService.getChartInsertLock(k), chartLoggerService.logger, name, schema);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {
		};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		const meta = await this.metaService.fetch();

		const suspendedInstancesQuery = this.instancesRepository.createQueryBuilder('instance')
			.select('instance.host')
			.where('instance.isSuspended = true');

		const pubsubSubQuery = this.followingsRepository.createQueryBuilder('f')
			.select('f.followerHost')
			.where('f.followerHost IS NOT NULL');

		const subInstancesQuery = this.followingsRepository.createQueryBuilder('f')
			.select('f.followeeHost')
			.where('f.followeeHost IS NOT NULL');

		const pubInstancesQuery = this.followingsRepository.createQueryBuilder('f')
			.select('f.followerHost')
			.where('f.followerHost IS NOT NULL');

		let sub: number | undefined;
		let pub: number | undefined;
		let pubsub: number | undefined;
		let subActive: number | undefined;
		let pubActive: number | undefined;

		try {
			const subRaw = await this.followingsRepository.createQueryBuilder('following')
				.select('COUNT(DISTINCT following.followeeHost)')
				.where('following.followeeHost IS NOT NULL')
				.andWhere(meta.blockedHosts.length === 0 ? '1=1' : 'following.followeeHost NOT ILIKE ANY(ARRAY[:...blocked])', { blocked: meta.blockedHosts.flatMap(x => [x, `%.${x}`]) })
				.andWhere(`following.followeeHost NOT IN (${ suspendedInstancesQuery.getQuery() })`)
				.getRawOne();
			sub = parseInt(subRaw.count, 10);

			const pubRaw = await this.followingsRepository.createQueryBuilder('following')
				.select('COUNT(DISTINCT following.followerHost)')
				.where('following.followerHost IS NOT NULL')
				.andWhere(meta.blockedHosts.length === 0 ? '1=1' : 'following.followerHost NOT ILIKE ANY(ARRAY[:...blocked])', { blocked: meta.blockedHosts.flatMap(x => [x, `%.${x}`]) })
				.andWhere(`following.followerHost NOT IN (${ suspendedInstancesQuery.getQuery() })`)
				.getRawOne();
			pub = parseInt(pubRaw.count, 10);

			const pubsubRaw = await this.followingsRepository.createQueryBuilder('following')
				.select('COUNT(DISTINCT following.followeeHost)')
				.where('following.followeeHost IS NOT NULL')
				.andWhere(meta.blockedHosts.length === 0 ? '1=1' : 'following.followeeHost NOT ILIKE ANY(ARRAY[:...blocked])', { blocked: meta.blockedHosts.flatMap(x => [x, `%.${x}`]) })
				.andWhere(`following.followeeHost NOT IN (${ suspendedInstancesQuery.getQuery() })`)
				.andWhere(`following.followeeHost IN (${ pubsubSubQuery.getQuery() })`)
				.setParameters(pubsubSubQuery.getParameters())
				.getRawOne();
			pubsub = parseInt(pubsubRaw.count, 10);

			const subActiveRaw = await this.instancesRepository.createQueryBuilder('instance')
				.select('COUNT(instance.id)')
				.where(`instance.host IN (${ subInstancesQuery.getQuery() })`)
				.andWhere(meta.blockedHosts.length === 0 ? '1=1' : 'instance.host NOT ILIKE ANY(ARRAY[:...blocked])', { blocked: meta.blockedHosts.flatMap(x => [x, `%.${x}`]) })
				.andWhere('instance.isSuspended = false')
				.andWhere('instance.isNotResponding = false')
				.getRawOne();
			subActive = parseInt(subActiveRaw.count, 10);

			const pubActiveRaw = await this.instancesRepository.createQueryBuilder('instance')
				.select('COUNT(instance.id)')
				.where(`instance.host IN (${ pubInstancesQuery.getQuery() })`)
				.andWhere(meta.blockedHosts.length === 0 ? '1=1' : 'instance.host NOT ILIKE ANY(ARRAY[:...blocked])', { blocked: meta.blockedHosts.flatMap(x => [x, `%.${x}`]) })
				.andWhere('instance.isSuspended = false')
				.andWhere('instance.isNotResponding = false')
				.getRawOne();
			pubActive = parseInt(pubActiveRaw.count, 10);
		} catch (e) {
			this.chartLoggerService.logger.warn('FederationChart.tickMinor query failed (falling back)', e as Record<string, any>);
			return {};
		}

		return {
			'sub': sub,
			'pub': pub,
			'pubsub': pubsub,
			'subActive': subActive,
			'pubActive': pubActive,
		};
	}

	@bindThis
	public async deliverd(host: string, succeeded: boolean): Promise<void> {
		await this.commit(succeeded ? {
			'deliveredInstances': [host],
		} : {
			'stalled': [host],
		});
	}

	@bindThis
	public async inbox(host: string): Promise<void> {
		await this.commit({
			'inboxInstances': [host],
		});
	}
}
