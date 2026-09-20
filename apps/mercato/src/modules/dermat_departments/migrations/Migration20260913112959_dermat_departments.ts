import { Migration } from '@mikro-orm/migrations';

export class Migration20260913112959_dermat_departments extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_departments" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "type" text not null, "contact_email" text null, "contact_phone" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_departments_org_tenant_idx" on "dermat_departments" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "dermat_departments" add constraint "dermat_departments_org_tenant_name_uq" unique ("organization_id", "tenant_id", "name");`);
  }

}
