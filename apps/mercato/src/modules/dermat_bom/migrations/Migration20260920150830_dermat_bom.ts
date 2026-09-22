import { Migration } from '@mikro-orm/migrations';

export class Migration20260920150830_dermat_bom extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_boms" add "metadata" jsonb null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_boms" drop column "metadata";`);
  }

}
