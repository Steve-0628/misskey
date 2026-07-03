import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import Channel from '../channel.js';

class DriveChannel extends Channel {
	public readonly chName = 'drive';
	public static shouldShare = true;
	public static requireCredential = true;

	@bindThis
	public async init(params: any) {
		// Subscribe drive stream
		this.subscriber.on(`driveStream:${this.user!.id}`, this.onDriveStreamData);
	}

	@bindThis
	private onDriveStreamData(data: any) {
		this.send(data);
	}

	@bindThis
	public dispose(): void {
		this.subscriber.off(`driveStream:${this.user!.id}`, this.onDriveStreamData);
	}
}

@Injectable()
export class DriveChannelService {
	public readonly shouldShare = DriveChannel.shouldShare;
	public readonly requireCredential = DriveChannel.requireCredential;

	constructor(
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): DriveChannel {
		return new DriveChannel(
			id,
			connection,
		);
	}
}
