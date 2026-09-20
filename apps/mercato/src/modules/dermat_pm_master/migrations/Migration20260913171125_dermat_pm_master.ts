import { Migration } from '@mikro-orm/migrations';

export class Migration20260913171125_dermat_pm_master extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_pm_master" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "name" text not null, "code" text not null, "stock" numeric(14,3) not null default 0, "unit" text not null, "make_brand_name" text null, "supplier" text null, "category" text null, "dimensions" text null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_pm_master_org_tenant_idx" on "dermat_pm_master" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "dermat_pm_master" add constraint "dermat_pm_master_org_tenant_code_uq" unique ("organization_id", "tenant_id", "code");`);
  }

}
