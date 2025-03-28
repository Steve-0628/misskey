export class DropNsfwAi1743161797869 {

    async up(queryRunner) {
			await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "sensitiveMediaDetectionSensitivity"`);
			await queryRunner.query(`DROP TYPE "public"."meta_sensitivemediadetectionsensitivity_enum"`);
			await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "sensitiveMediaDetection"`);
			await queryRunner.query(`DROP TYPE "public"."meta_sensitivemediadetection_enum"`);
			await queryRunner.query(`DROP INDEX "public"."IDX_8bdcd3dd2bddb78014999a16ce"`);
			await queryRunner.query(`DROP INDEX "public"."IDX_3b33dff77bb64b23c88151d23e"`);
			await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "autoSensitive"`);
			await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "setSensitiveFlagAutomatically"`);
			await queryRunner.query(`ALTER TABLE "drive_file" DROP COLUMN "maybePorn"`);
			await queryRunner.query(`ALTER TABLE "drive_file" DROP COLUMN "maybeSensitive"`);
			await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableSensitiveMediaDetectionForVideos"`);
		}

    async down(queryRunner) {
    }

}
