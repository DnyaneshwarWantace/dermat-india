import { Migration } from '@mikro-orm/migrations'

export class Migration20260829200001_production_stage_templates extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "manufacturing_production_stage_templates" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz null default now(),
        "deleted_at" timestamptz null,
        "name" text not null,
        "code" text not null,
        "description" text null,
        "sequence_number" int not null,
        "is_active" boolean not null default true,
        "default_work_center_id" uuid null,
        "default_machine_id" uuid null,
        "estimated_setup_minutes" numeric(10,2) not null default '0',
        "estimated_run_minutes" numeric(10,2) not null default '0',
        "requires_quality_check" boolean not null default false,
        "notes" text null,
        constraint "manufacturing_production_stage_templates_pkey" primary key ("id")
      );
    `)

    this.addSql(`create index "mfg_pst_org_tenant_idx" on "manufacturing_production_stage_templates" ("organization_id", "tenant_id");`)
    this.addSql(`create unique index "mfg_pst_org_code_unique_idx" on "manufacturing_production_stage_templates" ("organization_id", "code") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "manufacturing_production_stage_templates" cascade;`)
  }
}
