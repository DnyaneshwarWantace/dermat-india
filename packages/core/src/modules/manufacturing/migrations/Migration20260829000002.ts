import { Migration } from '@mikro-orm/migrations'

export class Migration20260829000002 extends Migration {
  override async up(): Promise<void> {
    // Production Orders
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_production_orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "order_number" text NOT NULL,
        "bom_id" uuid NOT NULL,
        "bom_name" text NOT NULL,
        "product_variant_id" uuid NOT NULL,
        "product_name" text NOT NULL,
        "planned_quantity" numeric(15,4) NOT NULL,
        "produced_quantity" numeric(15,4) NOT NULL DEFAULT 0,
        "rejected_quantity" numeric(15,4) NOT NULL DEFAULT 0,
        "unit_of_measure" text NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "priority" text NOT NULL DEFAULT 'normal',
        "planned_start_date" timestamptz NULL,
        "planned_end_date" timestamptz NULL,
        "actual_start_date" timestamptz NULL,
        "actual_end_date" timestamptz NULL,
        "warehouse_id" uuid NULL,
        "material_cost_cents" bigint NOT NULL DEFAULT 0,
        "labor_cost_cents" bigint NOT NULL DEFAULT 0,
        "overhead_cost_cents" bigint NOT NULL DEFAULT 0,
        "total_cost_cents" bigint NOT NULL DEFAULT 0,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_production_orders_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fk_mfg_po_bom" FOREIGN KEY ("bom_id") REFERENCES "manufacturing_bill_of_materials" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_po_tenant_org" ON "manufacturing_production_orders" ("tenant_id", "organization_id");`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_mfg_po_order_number_org" ON "manufacturing_production_orders" ("organization_id", "order_number") WHERE "deleted_at" IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_po_bom" ON "manufacturing_production_orders" ("bom_id");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_po_status" ON "manufacturing_production_orders" ("organization_id", "status") WHERE "deleted_at" IS NULL;`)

    // Production Stages
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_production_stages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "production_order_id" uuid NOT NULL,
        "sequence_number" int NOT NULL,
        "name" text NOT NULL,
        "description" text NULL,
        "work_center_id" uuid NULL,
        "machine_id" uuid NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "planned_quantity" numeric(15,4) NOT NULL,
        "produced_quantity" numeric(15,4) NOT NULL DEFAULT 0,
        "rejected_quantity" numeric(15,4) NOT NULL DEFAULT 0,
        "planned_setup_minutes" numeric(10,2) NOT NULL DEFAULT 0,
        "planned_run_minutes" numeric(10,2) NOT NULL DEFAULT 0,
        "actual_setup_minutes" numeric(10,2) NOT NULL DEFAULT 0,
        "actual_run_minutes" numeric(10,2) NOT NULL DEFAULT 0,
        "started_at" timestamptz NULL,
        "completed_at" timestamptz NULL,
        "operator_id" uuid NULL,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_production_stages_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fk_mfg_ps_po" FOREIGN KEY ("production_order_id") REFERENCES "manufacturing_production_orders" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT "fk_mfg_ps_wc" FOREIGN KEY ("work_center_id") REFERENCES "manufacturing_work_centers" ("id") ON UPDATE CASCADE ON DELETE SET NULL,
        CONSTRAINT "fk_mfg_ps_machine" FOREIGN KEY ("machine_id") REFERENCES "manufacturing_machines" ("id") ON UPDATE CASCADE ON DELETE SET NULL
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_ps_tenant_org" ON "manufacturing_production_stages" ("tenant_id", "organization_id");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_ps_po" ON "manufacturing_production_stages" ("production_order_id");`)

    // Material Consumptions
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_material_consumptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "production_order_id" uuid NOT NULL,
        "bom_line_id" uuid NULL,
        "product_variant_id" uuid NOT NULL,
        "product_name" text NOT NULL,
        "product_sku" text NULL,
        "planned_quantity" numeric(15,4) NOT NULL,
        "actual_quantity" numeric(15,4) NOT NULL DEFAULT 0,
        "wastage_quantity" numeric(15,4) NOT NULL DEFAULT 0,
        "unit_of_measure" text NULL,
        "unit_cost_cents" bigint NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'planned',
        "warehouse_id" uuid NULL,
        "lot_id" uuid NULL,
        "issued_at" timestamptz NULL,
        "issued_by" uuid NULL,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_material_consumptions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fk_mfg_mc_po" FOREIGN KEY ("production_order_id") REFERENCES "manufacturing_production_orders" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT "fk_mfg_mc_bom_line" FOREIGN KEY ("bom_line_id") REFERENCES "manufacturing_bom_lines" ("id") ON UPDATE CASCADE ON DELETE SET NULL
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_mc_tenant_org" ON "manufacturing_material_consumptions" ("tenant_id", "organization_id");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_mc_po" ON "manufacturing_material_consumptions" ("production_order_id");`)

    // Quality Inspections
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_quality_inspections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "inspection_number" text NOT NULL,
        "inspection_type" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "production_order_id" uuid NULL,
        "production_stage_id" uuid NULL,
        "product_variant_id" uuid NOT NULL,
        "product_name" text NOT NULL,
        "inspected_quantity" numeric(15,4) NOT NULL DEFAULT 0,
        "passed_quantity" numeric(15,4) NOT NULL DEFAULT 0,
        "failed_quantity" numeric(15,4) NOT NULL DEFAULT 0,
        "overall_result" text NULL,
        "inspector_id" uuid NULL,
        "inspected_at" timestamptz NULL,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_quality_inspections_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fk_mfg_qi_po" FOREIGN KEY ("production_order_id") REFERENCES "manufacturing_production_orders" ("id") ON UPDATE CASCADE ON DELETE SET NULL,
        CONSTRAINT "fk_mfg_qi_ps" FOREIGN KEY ("production_stage_id") REFERENCES "manufacturing_production_stages" ("id") ON UPDATE CASCADE ON DELETE SET NULL
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_qi_tenant_org" ON "manufacturing_quality_inspections" ("tenant_id", "organization_id");`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_mfg_qi_number_org" ON "manufacturing_quality_inspections" ("organization_id", "inspection_number") WHERE "deleted_at" IS NULL;`)

    // Quality Check Items
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "manufacturing_quality_check_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "inspection_id" uuid NOT NULL,
        "check_name" text NOT NULL,
        "description" text NULL,
        "specification" text NULL,
        "min_value" numeric(15,4) NULL,
        "max_value" numeric(15,4) NULL,
        "measured_value" numeric(15,4) NULL,
        "text_value" text NULL,
        "result" text NULL,
        "notes" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NULL,
        "deleted_at" timestamptz NULL,
        CONSTRAINT "manufacturing_quality_check_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fk_mfg_qci_inspection" FOREIGN KEY ("inspection_id") REFERENCES "manufacturing_quality_inspections" ("id") ON UPDATE CASCADE ON DELETE CASCADE
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_qci_tenant_org" ON "manufacturing_quality_check_items" ("tenant_id", "organization_id");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_mfg_qci_inspection" ON "manufacturing_quality_check_items" ("inspection_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_quality_check_items" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_quality_inspections" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_material_consumptions" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_production_stages" CASCADE;`)
    this.addSql(`DROP TABLE IF EXISTS "manufacturing_production_orders" CASCADE;`)
  }
}
