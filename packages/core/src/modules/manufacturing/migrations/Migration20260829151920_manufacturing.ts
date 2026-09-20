import { Migration } from '@mikro-orm/migrations';

export class Migration20260829151920_manufacturing extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "manufacturing_production_orders" add column "sales_order_id" uuid null, add column "sales_order_number" text null;`);
    this.addSql(`create index "mfg_po_sales_order_idx" on "manufacturing_production_orders" ("sales_order_id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index if exists "mfg_po_sales_order_idx";`);
    this.addSql(`alter table "manufacturing_production_orders" drop column if exists "sales_order_id", drop column if exists "sales_order_number";`);
  }

}
