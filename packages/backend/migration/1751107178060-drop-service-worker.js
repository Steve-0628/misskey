export class DropServiceWorker1751107178060 {


    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableServiceWorker"`);
				await queryRunner.query(`DROP TABLE "sw_subscription"`);
		}

    async down(queryRunner) {
    }


}
