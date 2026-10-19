import { Migration } from '@mikro-orm/migrations';

export class Migration20261019120000_dermat_orders extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table if not exists "dermat_artwork_approvals" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "order_id" uuid not null, "token_hash" text not null, "status" text not null default 'open', "file_ids" jsonb null, "client_name" text null, "client_designation" text null, "signature" text null, "comments" text null, "ip" text null, "user_agent" text null, "decided_at" timestamptz null, "expires_at" timestamptz not null, "created_by_name" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "dermat_artwork_approvals_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "dermat_artwork_approvals_order_idx" on "dermat_artwork_approvals" ("organization_id", "tenant_id", "order_id");`);
    this.addSql(`alter table "dermat_artwork_approvals" add constraint "dermat_artwork_approvals_token_uq" unique ("token_hash");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "dermat_artwork_approvals" cascade;`);
  }

}
