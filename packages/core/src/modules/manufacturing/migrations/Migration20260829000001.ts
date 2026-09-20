import { Migration } from '@mikro-orm/migrations'

export class Migration20260829000001 extends Migration {
  override async up(): Promise<void> {
    // Work Centers
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_work_centers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "code" varchar(100) NOT NULL,
        "description" text NULL,
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "cost_per_hour_cents" bigint NOT NULL DEFAULT 0,
        "capacity_per_day" numeric(15,4) NULL,
        "unit_of_measure" varchar(50) NULL,
        "location" varchar(255) NULL,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_work_centers_pkey" PRIMARY KEY ("id")
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_wc_tenant_org" ON "manufacturing_work_centers" ("tenant_id", "organization_id");`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_mfg_wc_code_org" ON "manufacturing_work_centers" ("organization_id", "code") WHERE "deleted_at" IS NULL;`)

    // Machines
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_machines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "code" varchar(100) NOT NULL,
        "description" text NULL,
        "status" varchar(50) NOT NULL DEFAULT 'available',
        "work_center_id" uuid NULL,
        "make_model" varchar(255) NULL,
        "serial_number" varchar(255) NULL,
        "purchase_date" timestamptz NULL,
        "last_maintenance_date" timestamptz NULL,
        "next_maintenance_date" timestamptz NULL,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_machines_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fk_mfg_machines_wc" FOREIGN KEY ("work_center_id") REFERENCES "manufacturing_work_centers" ("id") ON UPDATE CASCADE ON DELETE SET NULL
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_machines_tenant_org" ON "manufacturing_machines" ("tenant_id", "organization_id");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_machines_wc" ON "manufacturing_machines" ("work_center_id");`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_mfg_machines_code_org" ON "manufacturing_machines" ("organization_id", "code") WHERE "deleted_at" IS NULL;`)

    // Bills of Materials
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_bill_of_materials" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "code" varchar(100) NOT NULL,
        "description" text NULL,
        "product_variant_id" uuid NULL,
        "product_name" varchar(255) NULL,
        "product_sku" varchar(255) NULL,
        "output_quantity" numeric(15,4) NOT NULL DEFAULT 1,
        "unit_of_measure" varchar(50) NULL,
        "status" varchar(50) NOT NULL DEFAULT 'draft',
        "version" int NOT NULL DEFAULT 1,
        "is_default" boolean NOT NULL DEFAULT false,
        "material_cost_cents" bigint NOT NULL DEFAULT 0,
        "operation_cost_cents" bigint NOT NULL DEFAULT 0,
        "total_cost_cents" bigint NOT NULL DEFAULT 0,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_bom_pkey" PRIMARY KEY ("id")
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_bom_tenant_org" ON "manufacturing_bill_of_materials" ("tenant_id", "organization_id");`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_mfg_bom_code_org" ON "manufacturing_bill_of_materials" ("organization_id", "code") WHERE "deleted_at" IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_bom_product" ON "manufacturing_bill_of_materials" ("product_variant_id");`)

    // BOM Lines
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_bom_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "bom_id" uuid NOT NULL,
        "line_number" int NOT NULL DEFAULT 1,
        "product_variant_id" uuid NULL,
        "product_name" varchar(255) NULL,
        "product_sku" varchar(255) NULL,
        "quantity" numeric(15,4) NOT NULL DEFAULT 1,
        "unit_of_measure" varchar(50) NULL,
        "wastage_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "unit_cost_cents" bigint NOT NULL DEFAULT 0,
        "is_critical" boolean NOT NULL DEFAULT false,
        "sub_bom_id" uuid NULL,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_bom_lines_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fk_mfg_bom_lines_bom" FOREIGN KEY ("bom_id") REFERENCES "manufacturing_bill_of_materials" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT "fk_mfg_bom_lines_sub_bom" FOREIGN KEY ("sub_bom_id") REFERENCES "manufacturing_bill_of_materials" ("id") ON UPDATE CASCADE ON DELETE SET NULL
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_bom_lines_bom" ON "manufacturing_bom_lines" ("bom_id");`)

    // BOM Operations
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_bom_operations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "bom_id" uuid NOT NULL,
        "sequence_number" int NOT NULL DEFAULT 1,
        "name" varchar(255) NOT NULL,
        "description" text NULL,
        "work_center_id" uuid NULL,
        "machine_id" uuid NULL,
        "setup_time_minutes" numeric(10,2) NOT NULL DEFAULT 0,
        "run_time_minutes" numeric(10,2) NOT NULL DEFAULT 0,
        "cost_cents" bigint NOT NULL DEFAULT 0,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_bom_operations_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fk_mfg_bom_ops_bom" FOREIGN KEY ("bom_id") REFERENCES "manufacturing_bill_of_materials" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT "fk_mfg_bom_ops_wc" FOREIGN KEY ("work_center_id") REFERENCES "manufacturing_work_centers" ("id") ON UPDATE CASCADE ON DELETE SET NULL,
        CONSTRAINT "fk_mfg_bom_ops_machine" FOREIGN KEY ("machine_id") REFERENCES "manufacturing_machines" ("id") ON UPDATE CASCADE ON DELETE SET NULL
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_bom_ops_bom" ON "manufacturing_bom_operations" ("bom_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_bom_operations" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_bom_lines" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_bill_of_materials" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_machines" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_work_centers" CASCADE;`)
  }
}
