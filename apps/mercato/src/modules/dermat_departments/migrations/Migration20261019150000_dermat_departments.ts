import { Migration } from '@mikro-orm/migrations';

export class Migration20261019150000_dermat_departments extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_whatsapp_numbers" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "user_id" uuid not null, "phone" text not null, "enabled" boolean not null default true, "last_sent_at" timestamptz null, "last_error" text null, "sent_count" integer not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "dermat_whatsapp_numbers_pkey" primary key ("id"));`);
    this.addSql(`create unique index "dermat_whatsapp_numbers_user_uq" on "dermat_whatsapp_numbers" ("tenant_id", "user_id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "dermat_whatsapp_numbers" cascade;`);
  }

}
