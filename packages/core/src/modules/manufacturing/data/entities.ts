import { Collection, OptionalProps } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy'
import type { JsonValue } from '@wantace/shared/lib/json'

export type BOMStatus = 'draft' | 'active' | 'obsolete'
export type WorkCenterStatus = 'active' | 'inactive' | 'maintenance'
export type MachineStatus = 'available' | 'in_use' | 'maintenance' | 'retired'
export type ProductionOrderStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
export type ProductionStagePriority = 'low' | 'normal' | 'high' | 'urgent'
export type ProductionStageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type MaterialConsumptionStatus = 'planned' | 'issued' | 'returned' | 'scrapped'
export type QualityInspectionStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'on_hold'
export type QualityInspectionType = 'incoming' | 'in_process' | 'final' | 'periodic'
export type QualityCheckResult = 'pass' | 'fail' | 'conditional'

type ManufacturingOptionalProps = 'createdAt' | 'updatedAt' | 'deletedAt' | 'metadata'

abstract class ManufacturingScopedEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'jsonb', nullable: true })
  metadata?: JsonValue | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date(), nullable: true })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

// ── Work Center ──────────────────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_work_centers' })
@Index({ name: 'mfg_wc_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'mfg_wc_org_code_unique_idx',
  expression:
    'create unique index "mfg_wc_org_code_unique_idx" on "manufacturing_work_centers" ("organization_id", "code") where deleted_at is null',
})
export class WorkCenter extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'status' | 'costPerHourCents'

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text' })
  code!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'text', default: 'active' })
  status: WorkCenterStatus = 'active'

  @Property({ name: 'cost_per_hour_cents', type: 'bigint', default: 0 })
  costPerHourCents: number = 0

  @Property({ name: 'capacity_per_day', type: 'numeric', columnType: 'numeric(15,4)', nullable: true })
  capacityPerDay?: string | null

  @Property({ name: 'unit_of_measure', type: 'text', nullable: true })
  unitOfMeasure?: string | null

  @Property({ type: 'text', nullable: true })
  location?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @OneToMany(() => Machine, (m) => m.workCenter)
  machines = new Collection<Machine>(this)
}

// ── Machine ──────────────────────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_machines' })
@Index({ name: 'mfg_mc_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'mfg_mc_org_code_unique_idx',
  expression:
    'create unique index "mfg_mc_org_code_unique_idx" on "manufacturing_machines" ("organization_id", "code") where deleted_at is null',
})
@Index({ name: 'mfg_mc_wc_idx', properties: ['workCenter'] })
export class Machine extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'status'

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text' })
  code!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @ManyToOne(() => WorkCenter, { fieldName: 'work_center_id', nullable: true })
  workCenter?: WorkCenter | null

  @Property({ type: 'text', default: 'available' })
  status: MachineStatus = 'available'

  @Property({ name: 'make_model', type: 'text', nullable: true })
  makeModel?: string | null

  @Property({ name: 'serial_number', type: 'text', nullable: true })
  serialNumber?: string | null

  @Property({ name: 'purchase_date', type: Date, nullable: true })
  purchaseDate?: Date | null

  @Property({ name: 'last_maintenance_date', type: Date, nullable: true })
  lastMaintenanceDate?: Date | null

  @Property({ name: 'next_maintenance_date', type: Date, nullable: true })
  nextMaintenanceDate?: Date | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}

// ── Bill of Materials ────────────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_boms' })
@Index({ name: 'mfg_bom_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'mfg_bom_org_code_unique_idx',
  expression:
    'create unique index "mfg_bom_org_code_unique_idx" on "manufacturing_boms" ("organization_id", "code") where deleted_at is null',
})
@Index({ name: 'mfg_bom_product_idx', properties: ['organizationId', 'productVariantId'] })
export class BillOfMaterials extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'status' | 'version' | 'isDefault' | 'materialCostCents' | 'operationCostCents' | 'totalCostCents'

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text' })
  code!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'product_variant_id', type: 'uuid' })
  productVariantId!: string

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'output_quantity', type: 'numeric', columnType: 'numeric(15,4)' })
  outputQuantity!: string

  @Property({ name: 'unit_of_measure', type: 'text', nullable: true })
  unitOfMeasure?: string | null

  @Property({ type: 'text', default: 'draft' })
  status: BOMStatus = 'draft'

  @Property({ type: 'integer', default: 1 })
  version: number = 1

  @Property({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean = false

  @Property({ name: 'material_cost_cents', type: 'bigint', default: 0 })
  materialCostCents: number = 0

  @Property({ name: 'operation_cost_cents', type: 'bigint', default: 0 })
  operationCostCents: number = 0

  @Property({ name: 'total_cost_cents', type: 'bigint', default: 0 })
  totalCostCents: number = 0

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @OneToMany(() => BOMLine, (line) => line.bom)
  lines = new Collection<BOMLine>(this)

  @OneToMany(() => BOMOperation, (op) => op.bom)
  operations = new Collection<BOMOperation>(this)
}

// ── BOM Line (Raw Material) ──────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_bom_lines' })
@Index({ name: 'mfg_bl_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'mfg_bl_bom_idx', properties: ['bom'] })
@Index({ name: 'mfg_bl_product_idx', properties: ['organizationId', 'productVariantId'] })
export class BOMLine extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'lineTotal' | 'wastagePercent' | 'rmPercent'

  @ManyToOne(() => BillOfMaterials, { fieldName: 'bom_id' })
  bom!: BillOfMaterials

  @Property({ name: 'line_number', type: 'integer' })
  lineNumber!: number

  @Property({ name: 'product_variant_id', type: 'uuid' })
  productVariantId!: string

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'product_sku', type: 'text', nullable: true })
  productSku?: string | null

  @Property({ type: 'numeric', columnType: 'numeric(15,4)' })
  quantity!: string

  @Property({ name: 'rm_percent', type: 'numeric', columnType: 'numeric(6,3)', nullable: true })
  rmPercent?: string | null

  @Property({ name: 'unit_of_measure', type: 'text', nullable: true })
  unitOfMeasure?: string | null

  @Property({ name: 'wastage_percent', type: 'numeric', columnType: 'numeric(5,2)', default: '0' })
  wastagePercent: string = '0'

  @Property({ name: 'unit_cost_cents', type: 'bigint' })
  unitCostCents!: number

  @Property({ name: 'line_total', type: 'bigint', default: 0 })
  lineTotal: number = 0

  @Property({ name: 'is_critical', type: 'boolean', default: false })
  isCritical: boolean = false

  @Property({ name: 'sub_bom_id', type: 'uuid', nullable: true })
  subBomId?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}

// ── BOM Operation ────────────────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_bom_operations' })
@Index({ name: 'mfg_bo_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'mfg_bo_bom_idx', properties: ['bom'] })
@Index({ name: 'mfg_bo_wc_idx', properties: ['workCenterId'] })
export class BOMOperation extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'setupTimeMinutes' | 'runTimeMinutes' | 'costCents'

  @ManyToOne(() => BillOfMaterials, { fieldName: 'bom_id' })
  bom!: BillOfMaterials

  @Property({ name: 'sequence_number', type: 'integer' })
  sequenceNumber!: number

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'work_center_id', type: 'uuid', nullable: true })
  workCenterId?: string | null

  @Property({ name: 'machine_id', type: 'uuid', nullable: true })
  machineId?: string | null

  @Property({ name: 'setup_time_minutes', type: 'numeric', columnType: 'numeric(10,2)', default: '0' })
  setupTimeMinutes: string = '0'

  @Property({ name: 'run_time_minutes', type: 'numeric', columnType: 'numeric(10,2)', default: '0' })
  runTimeMinutes: string = '0'

  @Property({ name: 'cost_cents', type: 'bigint', default: 0 })
  costCents: number = 0

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}

// ── Production Order ────────────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_production_orders' })
@Index({ name: 'mfg_po_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'mfg_po_order_number_unique_idx',
  expression:
    'create unique index "mfg_po_order_number_unique_idx" on "manufacturing_production_orders" ("organization_id", "order_number") where deleted_at is null',
})
@Index({ name: 'mfg_po_bom_idx', properties: ['bomId'] })
@Index({ name: 'mfg_po_sales_order_idx', properties: ['salesOrderId'] })
export class ProductionOrder extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'status' | 'priority' | 'producedQuantity' | 'rejectedQuantity' | 'materialCostCents' | 'laborCostCents' | 'overheadCostCents' | 'totalCostCents'

  @Property({ name: 'order_number', type: 'text' })
  orderNumber!: string

  @Property({ name: 'sales_order_id', type: 'uuid', nullable: true })
  salesOrderId?: string | null

  @Property({ name: 'sales_order_number', type: 'text', nullable: true })
  salesOrderNumber?: string | null

  @Property({ name: 'bom_id', type: 'uuid' })
  bomId!: string

  @Property({ name: 'bom_name', type: 'text' })
  bomName!: string

  @Property({ name: 'product_variant_id', type: 'uuid' })
  productVariantId!: string

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'planned_quantity', type: 'numeric', columnType: 'numeric(15,4)' })
  plannedQuantity!: string

  @Property({ name: 'produced_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  producedQuantity: string = '0'

  @Property({ name: 'rejected_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  rejectedQuantity: string = '0'

  @Property({ name: 'unit_of_measure', type: 'text', nullable: true })
  unitOfMeasure?: string | null

  @Property({ type: 'text', default: 'draft' })
  status: ProductionOrderStatus = 'draft'

  @Property({ type: 'text', default: 'normal' })
  priority: ProductionStagePriority = 'normal'

  @Property({ name: 'planned_start_date', type: Date, nullable: true })
  plannedStartDate?: Date | null

  @Property({ name: 'planned_end_date', type: Date, nullable: true })
  plannedEndDate?: Date | null

  @Property({ name: 'actual_start_date', type: Date, nullable: true })
  actualStartDate?: Date | null

  @Property({ name: 'actual_end_date', type: Date, nullable: true })
  actualEndDate?: Date | null

  @Property({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId?: string | null

  @Property({ name: 'material_cost_cents', type: 'bigint', default: 0 })
  materialCostCents: number = 0

  @Property({ name: 'labor_cost_cents', type: 'bigint', default: 0 })
  laborCostCents: number = 0

  @Property({ name: 'overhead_cost_cents', type: 'bigint', default: 0 })
  overheadCostCents: number = 0

  @Property({ name: 'total_cost_cents', type: 'bigint', default: 0 })
  totalCostCents: number = 0

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @OneToMany(() => ProductionStage, (s) => s.productionOrder)
  stages = new Collection<ProductionStage>(this)

  @OneToMany(() => MaterialConsumption, (mc) => mc.productionOrder)
  materialConsumptions = new Collection<MaterialConsumption>(this)
}

// ── Production Stage ────────────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_production_stages' })
@Index({ name: 'mfg_ps_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'mfg_ps_po_idx', properties: ['productionOrder'] })
export class ProductionStage extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'status' | 'producedQuantity' | 'rejectedQuantity' | 'actualSetupMinutes' | 'actualRunMinutes'

  @ManyToOne(() => ProductionOrder, { fieldName: 'production_order_id' })
  productionOrder!: ProductionOrder

  @Property({ name: 'sequence_number', type: 'integer' })
  sequenceNumber!: number

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'work_center_id', type: 'uuid', nullable: true })
  workCenterId?: string | null

  @Property({ name: 'machine_id', type: 'uuid', nullable: true })
  machineId?: string | null

  @Property({ type: 'text', default: 'pending' })
  status: ProductionStageStatus = 'pending'

  @Property({ name: 'planned_quantity', type: 'numeric', columnType: 'numeric(15,4)' })
  plannedQuantity!: string

  @Property({ name: 'produced_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  producedQuantity: string = '0'

  @Property({ name: 'rejected_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  rejectedQuantity: string = '0'

  @Property({ name: 'planned_setup_minutes', type: 'numeric', columnType: 'numeric(10,2)', default: '0' })
  plannedSetupMinutes: string = '0'

  @Property({ name: 'planned_run_minutes', type: 'numeric', columnType: 'numeric(10,2)', default: '0' })
  plannedRunMinutes: string = '0'

  @Property({ name: 'actual_setup_minutes', type: 'numeric', columnType: 'numeric(10,2)', default: '0' })
  actualSetupMinutes: string = '0'

  @Property({ name: 'actual_run_minutes', type: 'numeric', columnType: 'numeric(10,2)', default: '0' })
  actualRunMinutes: string = '0'

  @Property({ name: 'started_at', type: Date, nullable: true })
  startedAt?: Date | null

  @Property({ name: 'completed_at', type: Date, nullable: true })
  completedAt?: Date | null

  @Property({ name: 'operator_id', type: 'uuid', nullable: true })
  operatorId?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}

// ── Material Consumption ────────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_material_consumptions' })
@Index({ name: 'mfg_mc_org_tenant_idx2', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'mfg_mc_po_idx', properties: ['productionOrder'] })
export class MaterialConsumption extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'status' | 'actualQuantity' | 'wastageQuantity'

  @ManyToOne(() => ProductionOrder, { fieldName: 'production_order_id' })
  productionOrder!: ProductionOrder

  @Property({ name: 'bom_line_id', type: 'uuid', nullable: true })
  bomLineId?: string | null

  @Property({ name: 'product_variant_id', type: 'uuid' })
  productVariantId!: string

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'product_sku', type: 'text', nullable: true })
  productSku?: string | null

  @Property({ name: 'planned_quantity', type: 'numeric', columnType: 'numeric(15,4)' })
  plannedQuantity!: string

  @Property({ name: 'actual_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  actualQuantity: string = '0'

  @Property({ name: 'wastage_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  wastageQuantity: string = '0'

  @Property({ name: 'unit_of_measure', type: 'text', nullable: true })
  unitOfMeasure?: string | null

  @Property({ name: 'unit_cost_cents', type: 'bigint', default: 0 })
  unitCostCents: number = 0

  @Property({ type: 'text', default: 'planned' })
  status: MaterialConsumptionStatus = 'planned'

  @Property({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId?: string | null

  @Property({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId?: string | null

  @Property({ name: 'issued_at', type: Date, nullable: true })
  issuedAt?: Date | null

  @Property({ name: 'issued_by', type: 'uuid', nullable: true })
  issuedBy?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}

// ── Quality Inspection ──────────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_quality_inspections' })
@Index({ name: 'mfg_qi_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'mfg_qi_number_unique_idx',
  expression:
    'create unique index "mfg_qi_number_unique_idx" on "manufacturing_quality_inspections" ("organization_id", "inspection_number") where deleted_at is null',
})
export class QualityInspection extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'status' | 'overallResult' | 'inspectedQuantity' | 'passedQuantity' | 'failedQuantity'

  @Property({ name: 'inspection_number', type: 'text' })
  inspectionNumber!: string

  @Property({ name: 'inspection_type', type: 'text' })
  inspectionType!: QualityInspectionType

  @Property({ type: 'text', default: 'pending' })
  status: QualityInspectionStatus = 'pending'

  @Property({ name: 'production_order_id', type: 'uuid', nullable: true })
  productionOrderId?: string | null

  @Property({ name: 'production_stage_id', type: 'uuid', nullable: true })
  productionStageId?: string | null

  @Property({ name: 'product_variant_id', type: 'uuid' })
  productVariantId!: string

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'inspected_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  inspectedQuantity: string = '0'

  @Property({ name: 'passed_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  passedQuantity: string = '0'

  @Property({ name: 'failed_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  failedQuantity: string = '0'

  @Property({ name: 'overall_result', type: 'text', nullable: true })
  overallResult?: QualityCheckResult | null

  @Property({ name: 'inspector_id', type: 'uuid', nullable: true })
  inspectorId?: string | null

  @Property({ name: 'inspected_at', type: Date, nullable: true })
  inspectedAt?: Date | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @OneToMany(() => QualityCheckItem, (item) => item.inspection)
  checkItems = new Collection<QualityCheckItem>(this)
}

// ── Quality Check Item ──────────────────────────────────────────────────────

@Entity({ tableName: 'manufacturing_quality_check_items' })
@Index({ name: 'mfg_qci_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'mfg_qci_inspection_idx', properties: ['inspection'] })
export class QualityCheckItem extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'result'

  @ManyToOne(() => QualityInspection, { fieldName: 'inspection_id' })
  inspection!: QualityInspection

  @Property({ name: 'check_name', type: 'text' })
  checkName!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'specification', type: 'text', nullable: true })
  specification?: string | null

  @Property({ name: 'min_value', type: 'numeric', columnType: 'numeric(15,4)', nullable: true })
  minValue?: string | null

  @Property({ name: 'max_value', type: 'numeric', columnType: 'numeric(15,4)', nullable: true })
  maxValue?: string | null

  @Property({ name: 'measured_value', type: 'numeric', columnType: 'numeric(15,4)', nullable: true })
  measuredValue?: string | null

  @Property({ name: 'text_value', type: 'text', nullable: true })
  textValue?: string | null

  @Property({ type: 'text', nullable: true })
  result?: QualityCheckResult | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}

// ── Production Stage Template ──────────────────────────────────────────────
// Configurable per client/industry — defines the production pipeline stages

@Entity({ tableName: 'manufacturing_production_stage_templates' })
@Index({ name: 'mfg_pst_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'mfg_pst_org_code_unique_idx',
  expression:
    'create unique index "mfg_pst_org_code_unique_idx" on "manufacturing_production_stage_templates" ("organization_id", "code") where deleted_at is null',
})
export class ProductionStageTemplate extends ManufacturingScopedEntity {
  [OptionalProps]?: ManufacturingOptionalProps | 'isActive' | 'estimatedSetupMinutes' | 'estimatedRunMinutes' | 'requiresQualityCheck'

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text' })
  code!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'sequence_number', type: 'integer' })
  sequenceNumber!: number

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'default_work_center_id', type: 'uuid', nullable: true })
  defaultWorkCenterId?: string | null

  @Property({ name: 'default_machine_id', type: 'uuid', nullable: true })
  defaultMachineId?: string | null

  @Property({ name: 'estimated_setup_minutes', type: 'numeric', columnType: 'numeric(10,2)', default: '0' })
  estimatedSetupMinutes: string = '0'

  @Property({ name: 'estimated_run_minutes', type: 'numeric', columnType: 'numeric(10,2)', default: '0' })
  estimatedRunMinutes: string = '0'

  @Property({ name: 'requires_quality_check', type: 'boolean', default: false })
  requiresQualityCheck: boolean = false

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}
