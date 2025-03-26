export class DropClip1743008354223 {

	async up(queryRunner) {
		queryRunner.query(`DROP TABLE IF EXISTS "clip_favorite";`);
		queryRunner.query(`DROP TABLE IF EXISTS "clip_note";`);
		queryRunner.query(`DROP TABLE IF EXISTS "clip";`);
	}

	async down(queryRunner) {
	}

}
