import { Migration } from '@mikro-orm/migrations';

export class Migration20261018120000_dermat_boms extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_packaging_codes" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "code" text not null, "name" text not null, "kind" text not null, "size" text null, "specs" text null, "components" jsonb not null default '[]', "printed_items" jsonb not null default '[]', "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_packaging_codes_org_tenant_idx" on "dermat_packaging_codes" ("organization_id", "tenant_id");`);
    this.addSql(`create unique index "dermat_packaging_codes_code_uq" on "dermat_packaging_codes" ("organization_id", "tenant_id", upper("code")) where "deleted_at" is null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "dermat_packaging_codes" cascade;`);
  }

}
