import { Migration } from '@mikro-orm/migrations';

export class Migration20261025150000_dermat_departments extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_push_subscriptions" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "user_id" uuid not null, "endpoint" text not null, "p256dh" text not null, "auth" text not null, "user_agent" text null, "last_sent_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "dermat_push_subscriptions_pkey" primary key ("id"));`);
    this.addSql(`alter table "dermat_push_subscriptions" add constraint "dermat_push_subscriptions_endpoint_uq" unique ("endpoint");`);
    this.addSql(`create index "dermat_push_subscriptions_user_idx" on "dermat_push_subscriptions" ("tenant_id", "user_id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "dermat_push_subscriptions" cascade;`);
  }

}
