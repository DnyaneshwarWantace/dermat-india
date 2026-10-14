import { Migration } from '@mikro-orm/migrations';

export class Migration20261014120000_dermat_boms extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "dermat_bom_headers" add "name" text null, add "yield_percent" numeric(6,2) not null default 100;`);
    this.addSql(`drop index if exists "dermat_bom_headers_one_draft_uq";`);
  }

  override down(): void | Promise<void> {
    this.addSql(`create unique index if not exists "dermat_bom_headers_one_draft_uq" on "dermat_bom_headers" ("product_id", coalesce("order_id", '00000000-0000-0000-0000-000000000000'::uuid)) where "status" = 'draft' and "deleted_at" is null;`);
    this.addSql(`alter table "dermat_bom_headers" drop column "name", drop column "yield_percent";`);
  }

}
