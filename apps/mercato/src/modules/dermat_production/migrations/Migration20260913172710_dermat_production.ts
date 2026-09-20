import { Migration } from '@mikro-orm/migrations';

export class Migration20260913172710_dermat_production extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "dermat_batch_stages" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "production_batch_id" uuid not null, "stage_type" text not null, "sequence_number" int not null, "is_skipped" boolean not null default false, "machine_used" text null, "operator_name" text null, "shift" text null, "planned_output_qty" numeric(14,3) null, "actual_output_qty" numeric(14,3) null, "wastage_qty" numeric(14,3) null, "wastage_action" text not null default 'pending_decision', "status" text not null default 'pending', "started_at" timestamptz null, "completed_at" timestamptz null, "signed_off_by" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_batch_stages_batch_idx" on "dermat_batch_stages" ("production_batch_id");`);
    this.addSql(`create index "dermat_batch_stages_org_tenant_idx" on "dermat_batch_stages" ("organization_id", "tenant_id");`);

    this.addSql(`create table "dermat_production_batches" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "batch_number" text not null, "order_id" text null, "product_name" text not null, "planned_quantity" numeric(14,3) not null, "planned_unit" text not null, "status" text not null default 'planned', "created_by" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "dermat_production_batches_org_tenant_idx" on "dermat_production_batches" ("organization_id", "tenant_id");`);
    this.addSql(`alter table "dermat_production_batches" add constraint "dermat_production_batches_org_tenant_number_uq" unique ("organization_id", "tenant_id", "batch_number");`);
  }

}
