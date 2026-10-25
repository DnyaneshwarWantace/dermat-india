import { Migration } from '@mikro-orm/migrations';

export class Migration20261025100000_dermat_departments extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_access_log" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "user_id" uuid not null, "user_name" text null, "changed_by_name" text null, "added" jsonb not null, "removed" jsonb not null, "created_at" timestamptz not null, constraint "dermat_access_log_pkey" primary key ("id"));`);
    this.addSql(`create index "dermat_access_log_scope_idx" on "dermat_access_log" ("tenant_id", "created_at");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "dermat_access_log" cascade;`);
  }

}
