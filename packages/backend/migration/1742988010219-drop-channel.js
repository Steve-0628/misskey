export class DropChannel1742988010219 {
		name = 'DropChannel1742988010219'

    async up(queryRunner) {
			 await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "channelId";`);
			 await queryRunner.query(`ALTER TABLE "note_unread" DROP COLUMN "noteChannelId";`);
			 await queryRunner.query(`DROP TABLE IF EXISTS "channel" CASCADE;`);
			 await queryRunner.query(`DROP TABLE IF EXISTS "channel_note_pining";`);
			 await queryRunner.query(`DROP TABLE IF EXISTS "channel_favorite";`);
			 await queryRunner.query(`DROP TABLE IF EXISTS "channel_following";`);
    }

    async down(queryRunner) {
    }

}
