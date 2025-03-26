export class DropAnnouncement1743009799597 {

	async up(queryRunner) {
		queryRunner.query(`DROP TABLE IF EXISTS "announcement_read";`);
		queryRunner.query(`DROP TABLE IF EXISTS "announcement";`);
	}

	async down(queryRunner) {
	}

}
