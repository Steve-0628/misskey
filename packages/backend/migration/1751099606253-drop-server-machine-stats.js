export class DropServerMachineStats1751099606253 {

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableIdenticonGeneration"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableServerMachineStats"`);
		}

    async down(queryRunner) {
    }

}
