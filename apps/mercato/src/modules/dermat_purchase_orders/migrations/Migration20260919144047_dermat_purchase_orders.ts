import { Migration } from '@mikro-orm/migrations';

export class Migration20260919144047_dermat_purchase_orders extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_purchase_orders" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "po_number" text not null, "department" text not null, "vendor_id" uuid not null, "bom_id" uuid null, "gst_number" text null, "payment_terms" text null, "po_date" date not null, "delivery_date" date null, "billing_address" text null, "delivery_address" text null, "status" text not null default 'draft', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_purchase_orders_org_tenant_idx" on "dermat_purchase_orders" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "dermat_purchase_orders" add constraint "dermat_purchase_orders_org_tenant_number_uq" unique ("organization_id", "tenant_id", "po_number");`);

    this.addSql(`create table "dermat_purchase_order_lines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "purchase_order_id" uuid not null, "line_kind" text not null, "raw_material_id" uuid null, "packaging_material_id" uuid null, "component_code" text null, "quantity" numeric(14,4) not null, "pack" numeric(14,4) null, "free_quantity" numeric(14,4) not null default '0', "mrp" numeric(14,4) null, "unit" text not null default 'kg', "received_quantity" numeric(14,4) not null default '0', "qc_approved" boolean not null default false, "qc_approved_at" timestamptz null, "qc_approved_by" text null, "sequence_number" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_purchase_order_lines_po_idx" on "dermat_purchase_order_lines" ("purchase_order_id");`);
    this.addSql(`create index "dermat_purchase_order_lines_org_tenant_idx" on "dermat_purchase_order_lines" ("organization_id", "tenant_id");`);

    this.addSql(`create table "dermat_purchase_order_sequences" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "financial_year" text not null, "current_value" int not null default 0, primary key ("id"));`);
    this.addSql(`alter table "dermat_purchase_order_sequences" add constraint "dermat_po_sequences_org_tenant_fy_uq" unique ("organization_id", "tenant_id", "financial_year");`);
  }

}
