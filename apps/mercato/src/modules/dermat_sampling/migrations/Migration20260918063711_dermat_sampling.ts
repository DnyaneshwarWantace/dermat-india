import { Migration } from '@mikro-orm/migrations';

export class Migration20260918063711_dermat_sampling extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_samples" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "order_id" text not null, "product_name" text null, "status" text not null default 'requested', "requested_by" text null, "requested_at" timestamptz null, "sent_at" timestamptz null, "customer_decision_at" timestamptz null, "rejection_reason" text null, "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_samples_order_idx" on "dermat_samples" ("order_id");`);
    this.addSql(`create index "dermat_samples_org_tenant_idx" on "dermat_samples" ("organization_id", "tenant_id");`);
  }

}
