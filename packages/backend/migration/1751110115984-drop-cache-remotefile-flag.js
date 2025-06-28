export class DropCacheRemotefileFlag1751110115984 {

    async up(queryRunner) {
			await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "cacheRemoteFiles"`);
			await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "cacheRemoteSensitiveFiles"`);
    }

    async down(queryRunner) {
    }

}
