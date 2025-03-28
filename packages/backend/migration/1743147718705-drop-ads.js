export class DropAds1743147718705 {

	async up(queryRunner) {
		queryRunner.query(`DROP TABLE IF EXISTS "ad";`);
	}

	async down(queryRunner) {
	}

}
