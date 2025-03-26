
export class DropGallery1742993479194 {

    async up(queryRunner) {
			queryRunner.query(`DROP TABLE IF EXISTS "gallery_like";`);
			queryRunner.query(`DROP TABLE IF EXISTS "gallery_post";`);
    }

    async down(queryRunner) {
    }

}
