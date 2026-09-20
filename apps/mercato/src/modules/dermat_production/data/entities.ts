import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { OptionalProps } from '@mikro-orm/core'

export type ProductionBatchStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'
export type BatchStageType = 'bulk' | 'semi_finished' | 'finished'
export type BatchStageStatus = 'pending' | 'in_progress' | 'done' | 'qc_pending' | 'qc_passed' | 'qc_failed'
export type WastageAction = 'wasted' | 'returned_to_stock' | 'pending_decision'

@Entity({ tableName: 'dermat_production_batches' })
@Index({ name: 'dermat_production_batches_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'dermat_production_batches_org_tenant_number_uq', properties: ['organizationId', 'tenantId', 'batchNumber'] })
export class ProductionBatch {
  [OptionalProps]?:
    | 'status'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'batch_number', type: 'text' })
  batchNumber!: string

  @Property({ name: 'order_id', type: 'text', nullable: true })
  orderId?: string | null

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'planned_quantity', type: 'numeric', precision: 14, scale: 3 })
  plannedQuantity!: string

  @Property({ name: 'planned_unit', type: 'text' })
  plannedUnit!: string

  @Property({ type: 'text' })
  status: ProductionBatchStatus = 'planned'

  @Property({ name: 'created_by', type: 'text', nullable: true })
  createdBy?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'dermat_batch_stages' })
@Index({ name: 'dermat_batch_stages_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'dermat_batch_stages_batch_idx', properties: ['productionBatchId'] })
export class BatchStage {
  [OptionalProps]?:
    | 'isSkipped'
    | 'status'
    | 'wastageAction'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'production_batch_id', type: 'uuid' })
  productionBatchId!: string

  @Property({ name: 'stage_type', type: 'text' })
  stageType!: BatchStageType

  @Property({ name: 'sequence_number', type: 'integer' })
  sequenceNumber!: number

  @Property({ name: 'is_skipped', type: 'boolean', default: false })
  isSkipped: boolean = false

  @Property({ name: 'machine_used', type: 'text', nullable: true })
  machineUsed?: string | null

  @Property({ name: 'operator_name', type: 'text', nullable: true })
  operatorName?: string | null

  @Property({ type: 'text', nullable: true })
  shift?: string | null

  @Property({ name: 'planned_output_qty', type: 'numeric', precision: 14, scale: 3, nullable: true })
  plannedOutputQty?: string | null

  @Property({ name: 'actual_output_qty', type: 'numeric', precision: 14, scale: 3, nullable: true })
  actualOutputQty?: string | null

  @Property({ name: 'wastage_qty', type: 'numeric', precision: 14, scale: 3, nullable: true })
  wastageQty?: string | null

  @Property({ name: 'wastage_action', type: 'text' })
  wastageAction: WastageAction = 'pending_decision'

  @Property({ type: 'text' })
  status: BatchStageStatus = 'pending'

  @Property({ name: 'started_at', type: Date, nullable: true })
  startedAt?: Date | null

  @Property({ name: 'completed_at', type: Date, nullable: true })
  completedAt?: Date | null

  @Property({ name: 'signed_off_by', type: 'text', nullable: true })
  signedOffBy?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
