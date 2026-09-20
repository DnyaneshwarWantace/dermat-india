import { Migration } from '@mikro-orm/migrations';

export class Migration20260829000002_purchasing extends Migration {

  override up(): void | Promise<void> {
    // Supplier Pricing
    this.addSql(`create table "purchasing_supplier_pricing" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz null, "deleted_at" timestamptz null, "supplier_id" uuid not null, "product_variant_id" uuid not null, "product_name" text not null, "product_sku" text null, "unit_price_cents" bigint not null, "currency_code" text null, "min_quantity" numeric(15,4) not null default '1', "lead_time_days" int null, "valid_from" timestamptz null, "valid_to" timestamptz null, "is_active" boolean not null default true, "notes" text null, primary key ("id"));`);
    this.addSql(`create index "purchasing_sp_org_tenant_idx" on "purchasing_supplier_pricing" ("organization_id", "tenant_id");`);
    this.addSql(`create index "purchasing_sp_supplier_idx" on "purchasing_supplier_pricing" ("supplier_id");`);
    this.addSql(`create index "purchasing_sp_product_idx" on "purchasing_supplier_pricing" ("organization_id", "product_variant_id");`);

    // Purchase Invoices
    this.addSql(`create table "purchasing_purchase_invoices" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz null, "deleted_at" timestamptz null, "invoice_number" text not null, "supplier_invoice_number" text null, "supplier_id" uuid not null, "purchase_order_id" uuid null, "goods_receipt_id" uuid null, "status" text not null default 'draft', "invoice_date" timestamptz not null, "due_date" timestamptz null, "currency_code" text null, "subtotal_cents" bigint not null default 0, "tax_cents" bigint not null default 0, "total_cents" bigint not null default 0, "paid_cents" bigint not null default 0, "balance_cents" bigint not null default 0, "payment_terms" text null, "approved_by_user_id" uuid null, "approved_at" timestamptz null, "notes" text null, primary key ("id"));`);
    this.addSql(`create index "purchasing_pi_org_tenant_idx" on "purchasing_purchase_invoices" ("organization_id", "tenant_id");`);
    this.addSql(`create unique index "purchasing_pi_org_number_unique_idx" on "purchasing_purchase_invoices" ("organization_id", "invoice_number") where deleted_at is null;`);
    this.addSql(`create index "purchasing_pi_supplier_idx" on "purchasing_purchase_invoices" ("supplier_id");`);
    this.addSql(`create index "purchasing_pi_po_idx" on "purchasing_purchase_invoices" ("purchase_order_id");`);

    // Purchase Invoice Lines
    this.addSql(`create table "purchasing_purchase_invoice_lines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz null, "deleted_at" timestamptz null, "purchase_invoice_id" uuid not null, "purchase_order_line_id" uuid null, "line_number" int not null, "product_variant_id" uuid null, "product_name" text not null, "description" text null, "quantity" numeric(15,4) not null, "unit_of_measure" text null, "unit_price_cents" bigint not null, "line_total" bigint not null default 0, "tax_rate" numeric(5,2) null, "notes" text null, primary key ("id"));`);
    this.addSql(`create index "purchasing_pil_org_tenant_idx" on "purchasing_purchase_invoice_lines" ("organization_id", "tenant_id");`);
    this.addSql(`create index "purchasing_pil_pi_idx" on "purchasing_purchase_invoice_lines" ("purchase_invoice_id");`);

    // Foreign keys
    this.addSql(`alter table "purchasing_supplier_pricing" add constraint "purchasing_supplier_pricing_supplier_id_foreign" foreign key ("supplier_id") references "purchasing_suppliers" ("id");`);
    this.addSql(`alter table "purchasing_purchase_invoice_lines" add constraint "purchasing_purchase_invoice_lines_purchase_invoice_id_foreign" foreign key ("purchase_invoice_id") references "purchasing_purchase_invoices" ("id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "purchasing_purchase_invoice_lines" drop constraint if exists "purchasing_purchase_invoice_lines_purchase_invoice_id_foreign";`);
    this.addSql(`alter table "purchasing_supplier_pricing" drop constraint if exists "purchasing_supplier_pricing_supplier_id_foreign";`);
    this.addSql(`drop table if exists "purchasing_purchase_invoice_lines";`);
    this.addSql(`drop table if exists "purchasing_purchase_invoices";`);
    this.addSql(`drop table if exists "purchasing_supplier_pricing";`);
  }
}
