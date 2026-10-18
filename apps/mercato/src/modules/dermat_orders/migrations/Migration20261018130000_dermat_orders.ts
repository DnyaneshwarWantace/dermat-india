import { Migration } from '@mikro-orm/migrations';

export class Migration20261018130000_dermat_orders extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_orders" add column if not exists "coordinator" text null;`);
    this.addSql(`alter table "dermat_order_lines" add column if not exists "same_as_product_id" uuid null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "dermat_order_lines" drop column if exists "same_as_product_id";`);
    this.addSql(`alter table "dermat_orders" drop column if exists "coordinator";`);
  }

}
