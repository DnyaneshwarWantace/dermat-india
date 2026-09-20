import { Migration } from '@mikro-orm/migrations';

export class Migration20260914084145_dermat_bom extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_formulations" add "catalog_product_id" uuid null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_formulations" drop column "catalog_product_id";`);
  }

}
