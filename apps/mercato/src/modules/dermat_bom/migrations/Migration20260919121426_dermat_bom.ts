import { Migration } from '@mikro-orm/migrations';

export class Migration20260919121426_dermat_bom extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_formulations" add "density_g_per_ml" numeric(10,4) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_formulations" drop column "density_g_per_ml";`);
  }

}
