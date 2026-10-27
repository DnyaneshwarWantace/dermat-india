import { Migration } from '@mikro-orm/migrations';

export class Migration20261019130000_dermat_orders extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table if not exists "dermat_doc_links" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "token" text not null, "kind" text not null, "record_id" uuid not null, "order_id" uuid null, "customer_id" uuid null, "title" text not null, "sends" jsonb null, "opened_count" integer not null default 0, "last_opened_at" timestamptz null, "revoked_at" timestamptz null, "created_by_name" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "dermat_doc_links_pkey" primary key ("id"));`);
    this.addSql(`create unique index if not exists "dermat_doc_links_token_uq" on "dermat_doc_links" ("token");`);
    this.addSql(`create index if not exists "dermat_doc_links_record_idx" on "dermat_doc_links" ("organization_id", "tenant_id", "kind", "record_id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "dermat_doc_links" cascade;`);
  }

}
