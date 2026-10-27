import { Migration } from '@mikro-orm/migrations';

export class Migration20261018140000_dermat_accounts extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table if not exists "dermat_sample_charges" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "customer_id" uuid not null, "rd_request_id" uuid null, "rd_code" text null, "amount" numeric(14,2) not null, "paid_on" text not null, "mode" text null, "reference" text null, "note" text null, "by_name" text null, "voided_at" timestamptz null, "void_reason" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index if not exists "dermat_sample_charges_customer_idx" on "dermat_sample_charges" ("organization_id", "tenant_id", "customer_id");`);
    this.addSql(`alter table "dermat_proforma_invoices" alter column "order_id" drop not null, alter column "order_no" drop not null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "dermat_sample_charges" cascade;`);
    this.addSql(`alter table "dermat_proforma_invoices" alter column "order_id" set not null, alter column "order_no" set not null;`);
  }

}
