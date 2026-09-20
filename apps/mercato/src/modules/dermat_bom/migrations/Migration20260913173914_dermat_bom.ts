import { Migration } from '@mikro-orm/migrations';

export class Migration20260913173914_dermat_bom extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_bom_formulations" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "product_name" text not null, "formulation_name" text not null, "base_batch_size" numeric(14,3) not null, "base_batch_unit" text not null default 'kg', "version" int not null default 1, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_bom_formulations_org_tenant_idx" on "dermat_bom_formulations" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "dermat_bom_formulations" add constraint "dermat_bom_formulations_org_tenant_product_uq" unique ("organization_id", "tenant_id", "product_name");`);

    this.addSql(`create table "dermat_bom_formulation_lines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "formulation_id" uuid not null, "component_type" text not null, "component_name" text not null, "component_code" text null, "percent_of_formula" numeric(8,4) not null, "unit" text not null default 'kg', "sequence_number" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_bom_formulation_lines_formulation_idx" on "dermat_bom_formulation_lines" ("formulation_id");`);
    this.addSql(`create index "dermat_bom_formulation_lines_org_tenant_idx" on "dermat_bom_formulation_lines" ("organization_id", "tenant_id");`);

    this.addSql(`create table "dermat_bom_order_calculations" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "formulation_id" uuid not null, "order_reference" text null, "pack_size_breakdown_json" jsonb not null, "total_bulk_ml" numeric(14,3) not null, "total_bulk_kg" numeric(14,3) not null, "calculated_lines_json" jsonb not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_bom_order_calculations_formulation_idx" on "dermat_bom_order_calculations" ("formulation_id");`);
    this.addSql(`create index "dermat_bom_order_calculations_org_tenant_idx" on "dermat_bom_order_calculations" ("organization_id", "tenant_id");`);
  }

}
