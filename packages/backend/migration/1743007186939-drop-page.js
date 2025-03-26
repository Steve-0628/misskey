export class DropPage1743007186939 {

    async up(queryRunner) {
			queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "pinnedPageId";`);
			queryRunner.query(`DROP TABLE IF EXISTS "page_like";`);
			queryRunner.query(`DROP TABLE IF EXISTS "page";`);
    }

    async down(queryRunner) {
    }

}
