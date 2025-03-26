export class DropPage1743007186939 {

    async up(queryRunner) {
			queryRunner.query(`DROP TABLE IF EXISTS "page";`);
			queryRunner.query(`DROP TABLE IF EXISTS "page_like";`);
    }

    async down(queryRunner) {
    }

}
