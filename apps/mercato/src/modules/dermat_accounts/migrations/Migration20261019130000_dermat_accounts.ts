import { Migration } from '@mikro-orm/migrations';

export class Migration20261019130000_dermat_accounts extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table if not exists "dermat_customer_registrations" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "token" text not null, "customer_id" uuid null, "status" text not null default 'open', "answers" jsonb null, "submitted_at" timestamptz null, "ip" text null, "decided_by_name" text null, "decided_at" timestamptz null, "note" text null, "created_by_name" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "dermat_customer_registrations_pkey" primary key ("id"));`);
    this.addSql(`create unique index if not exists "dermat_customer_registrations_token_uq" on "dermat_customer_registrations" ("token");`);
    this.addSql(`alter table "dermat_tax_invoices" add column if not exists "irn" text null, add column if not exists "ack_no" text null, add column if not exists "ack_date" text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "dermat_customer_registrations" cascade;`);
    this.addSql(`alter table "dermat_tax_invoices" drop column if exists "irn", drop column if exists "ack_no", drop column if exists "ack_date";`);
  }

}
