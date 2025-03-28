export class DropRelay1743151897153 {

	async up(queryRunner) {
		queryRunner.query(`DROP INDEX "IDX_0d9a1738f2cf7f3b1c3334dfab"`);
		queryRunner.query(`DROP TABLE "relay"`);
		queryRunner.query(`DROP TYPE "relay_status_enum"`);
	}

	async down(queryRunner) {
	}

}
