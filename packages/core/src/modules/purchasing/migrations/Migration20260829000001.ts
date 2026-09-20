import { Migration } from '@mikro-orm/migrations';

export class Migration20260829000001_purchasing extends Migration {

  override up(): void | Promise<void> {
    // Suppliers
    this.addSql(`create table "purchasing_suppliers" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz null, "deleted_at" timestamptz null, "name" text not null, "code" text not null, "description" text null, "status" text not null default 'active', "is_active" boolean not null default true, "contact_name" text null, "contact_email" text null, "contact_phone" text null, "website" text null, "tax_id" text null, "address_line1" text null, "address_line2" text null, "city" text null, "state" text null, "postal_code" text null, "country" text null, "currency_code" text null, "payment_terms" text null, "lead_time_days" int null, "notes" text null, primary key ("id"));`);
    this.addSql(`create index "purchasing_suppliers_org_tenant_idx" on "purchasing_suppliers" ("organization_id", "tenant_id");`);
    this.addSql(`create unique index "purchasing_suppliers_org_code_unique_idx" on "purchasing_suppliers" ("organization_id", "code") where deleted_at is null;`);

    // Purchase Orders
    this.addSql(`create table "purchasing_purchase_orders" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz null, "deleted_at" timestamptz null, "order_number" text not null, "supplier_id" uuid not null, "status" text not null default 'draft', "order_date" timestamptz not null, "expected_delivery_date" timestamptz null, "warehouse_id" uuid null, "currency_code" text null, "subtotal_cents" bigint not null default 0, "tax_cents" bigint not null default 0, "total_cents" bigint not null default 0, "payment_terms" text null, "shipping_method" text null, "created_by_user_id" uuid null, "approved_by_user_id" uuid null, "approved_at" timestamptz null, "notes" text null, primary key ("id"));`);
    this.addSql(`create index "purchasing_po_org_tenant_idx" on "purchasing_purchase_orders" ("organization_id", "tenant_id");`);
    this.addSql(`create unique index "purchasing_po_org_number_unique_idx" on "purchasing_purchase_orders" ("organization_id", "order_number") where deleted_at is null;`);
    this.addSql(`create index "purchasing_po_supplier_idx" on "purchasing_purchase_orders" ("supplier_id");`);
    this.addSql(`create index "purchasing_po_status_idx" on "purchasing_purchase_orders" ("organization_id", "status");`);

    // Purchase Order Lines
    this.addSql(`create table "purchasing_purchase_order_lines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz null, "deleted_at" timestamptz null, "purchase_order_id" uuid not null, "line_number" int not null, "product_variant_id" uuid null, "product_name" text not null, "product_sku" text null, "description" text null, "quantity" numeric(15,4) not null, "unit_of_measure" text null, "unit_price_cents" bigint not null, "line_total" bigint not null default 0, "tax_rate" numeric(5,2) null, "received_quantity" numeric(15,4) not null default '0', "status" text not null default 'pending', "notes" text null, primary key ("id"));`);
    this.addSql(`create index "purchasing_pol_org_tenant_idx" on "purchasing_purchase_order_lines" ("organization_id", "tenant_id");`);
    this.addSql(`create index "purchasing_pol_po_idx" on "purchasing_purchase_order_lines" ("purchase_order_id");`);
    this.addSql(`create index "purchasing_pol_product_idx" on "purchasing_purchase_order_lines" ("organization_id", "product_variant_id");`);

    // Goods Receipts
    this.addSql(`create table "purchasing_goods_receipts" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz null, "deleted_at" timestamptz null, "receipt_number" text not null, "purchase_order_id" uuid not null, "status" text not null default 'draft', "receipt_date" timestamptz not null, "warehouse_id" uuid null, "received_by_user_id" uuid null, "notes" text null, primary key ("id"));`);
    this.addSql(`create index "purchasing_gr_org_tenant_idx" on "purchasing_goods_receipts" ("organization_id", "tenant_id");`);
    this.addSql(`create unique index "purchasing_gr_org_number_unique_idx" on "purchasing_goods_receipts" ("organization_id", "receipt_number") where deleted_at is null;`);
    this.addSql(`create index "purchasing_gr_po_idx" on "purchasing_goods_receipts" ("purchase_order_id");`);

    // Goods Receipt Lines
    this.addSql(`create table "purchasing_goods_receipt_lines" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz null, "deleted_at" timestamptz null, "goods_receipt_id" uuid not null, "purchase_order_line_id" uuid not null, "product_variant_id" uuid null, "product_name" text not null, "received_quantity" numeric(15,4) not null, "accepted_quantity" numeric(15,4) not null default '0', "rejected_quantity" numeric(15,4) not null default '0', "batch_number" text null, "lot_number" text null, "expiry_date" timestamptz null, "warehouse_location_id" uuid null, "notes" text null, primary key ("id"));`);
    this.addSql(`create index "purchasing_grl_org_tenant_idx" on "purchasing_goods_receipt_lines" ("organization_id", "tenant_id");`);
    this.addSql(`create index "purchasing_grl_gr_idx" on "purchasing_goods_receipt_lines" ("goods_receipt_id");`);
    this.addSql(`create index "purchasing_grl_pol_idx" on "purchasing_goods_receipt_lines" ("purchase_order_line_id");`);

    // Foreign keys
    this.addSql(`alter table "purchasing_purchase_orders" add constraint "purchasing_purchase_orders_supplier_id_foreign" foreign key ("supplier_id") references "purchasing_suppliers" ("id");`);
    this.addSql(`alter table "purchasing_purchase_order_lines" add constraint "purchasing_purchase_order_lines_purchase_order_id_foreign" foreign key ("purchase_order_id") references "purchasing_purchase_orders" ("id");`);
    this.addSql(`alter table "purchasing_goods_receipts" add constraint "purchasing_goods_receipts_purchase_order_id_foreign" foreign key ("purchase_order_id") references "purchasing_purchase_orders" ("id");`);
    this.addSql(`alter table "purchasing_goods_receipt_lines" add constraint "purchasing_goods_receipt_lines_goods_receipt_id_foreign" foreign key ("goods_receipt_id") references "purchasing_goods_receipts" ("id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "purchasing_goods_receipt_lines" drop constraint if exists "purchasing_goods_receipt_lines_goods_receipt_id_foreign";`);
    this.addSql(`alter table "purchasing_goods_receipts" drop constraint if exists "purchasing_goods_receipts_purchase_order_id_foreign";`);
    this.addSql(`alter table "purchasing_purchase_order_lines" drop constraint if exists "purchasing_purchase_order_lines_purchase_order_id_foreign";`);
    this.addSql(`alter table "purchasing_purchase_orders" drop constraint if exists "purchasing_purchase_orders_supplier_id_foreign";`);
    this.addSql(`drop table if exists "purchasing_goods_receipt_lines";`);
    this.addSql(`drop table if exists "purchasing_goods_receipts";`);
    this.addSql(`drop table if exists "purchasing_purchase_order_lines";`);
    this.addSql(`drop table if exists "purchasing_purchase_orders";`);
    this.addSql(`drop table if exists "purchasing_suppliers";`);
  }
}
