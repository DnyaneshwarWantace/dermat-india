import { Migration } from '@mikro-orm/migrations';

export class Migration20260913172711_dermat_qc extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_qc_policies" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "applies_to" text not null, "chemical_required" boolean not null default true, "micro_required" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_qc_policies_org_tenant_idx" on "dermat_qc_policies" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "dermat_qc_policies" add constraint "dermat_qc_policies_org_tenant_applies_to_uq" unique ("organization_id", "tenant_id", "applies_to");`);

    this.addSql(`create table "dermat_qc_tests" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "reference_type" text not null, "reference_id" text null, "test_type" text not null, "result" text not null default 'pending', "tested_by" text null, "tested_at" timestamptz null, "remarks" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_qc_tests_reference_idx" on "dermat_qc_tests" ("reference_type", "reference_id");`);
    this.addSql(`create index "dermat_qc_tests_org_tenant_idx" on "dermat_qc_tests" ("organization_id", "tenant_id");`);
  }

}
