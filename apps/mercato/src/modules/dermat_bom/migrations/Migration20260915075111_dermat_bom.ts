import { Migration } from '@mikro-orm/migrations';

export class Migration20260915075111_dermat_bom extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_boms" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "bom_name" text not null, "catalog_product_id" uuid null, "version" int not null default 1, "is_active" boolean not null default true, "depth" int not null default 0, "descendant_ids" jsonb not null default '[]', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_boms_org_tenant_idx" on "dermat_boms" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "dermat_boms" add constraint "dermat_boms_org_tenant_name_uq" unique ("organization_id", "tenant_id", "bom_name");`);

    this.addSql(`create table "dermat_bom_lines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "bom_id" uuid not null, "component_kind" text not null, "formulation_id" uuid null, "packaging_material_id" uuid null, "sub_bom_id" uuid null, "quantity" numeric(14,4) not null, "unit" text not null default 'unit', "sequence_number" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_bom_lines_bom_idx" on "dermat_bom_lines" ("bom_id");`);
    this.addSql(`create index "dermat_bom_lines_org_tenant_idx" on "dermat_bom_lines" ("organization_id", "tenant_id");`);
  }

}
