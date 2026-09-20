import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { OptionalProps } from '@mikro-orm/core'

export type PurchaseOrderDepartment = 'rm_store' | 'pm_store'
export type PurchaseOrderStatus = 'draft' | 'issued' | 'partially_received' | 'received' | 'cancelled'
export type PurchaseOrderLineKind = 'raw_material' | 'packaging_material'

@Entity({ tableName: 'dermat_purchase_orders' })
@Index({ name: 'dermat_purchase_orders_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Unique({
  name: 'dermat_purchase_orders_org_tenant_number_uq',
  properties: ['organizationId', 'tenantId', 'poNumber'],
})
export class PurchaseOrder {
  [OptionalProps]?:
    | 'status'
    | 'gstNumber'
    | 'paymentTerms'
    | 'deliveryDate'
    | 'billingAddress'
    | 'deliveryAddress'
    | 'bomId'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'po_number', type: 'text' })
  poNumber!: string

  @Property({ type: 'text' })
  department!: PurchaseOrderDepartment

  @Property({ name: 'vendor_id', type: 'uuid' })
  vendorId!: string

  // BOM this PO was raised from, if any — nullable since a PO could in principle be
  // raised without a specific BOM context, though the primary flow is BOM-driven.
  @Property({ name: 'bom_id', type: 'uuid', nullable: true })
  bomId?: string | null

  @Property({ name: 'gst_number', type: 'text', nullable: true })
  gstNumber?: string | null

  @Property({ name: 'payment_terms', type: 'text', nullable: true })
  paymentTerms?: string | null

  @Property({ name: 'po_date', type: 'date' })
  poDate!: string

  @Property({ name: 'delivery_date', type: 'date', nullable: true })
  deliveryDate?: string | null

  @Property({ name: 'billing_address', type: 'text', nullable: true })
  billingAddress?: string | null

  @Property({ name: 'delivery_address', type: 'text', nullable: true })
  deliveryAddress?: string | null

  @Property({ type: 'text', default: 'draft' })
  status: PurchaseOrderStatus = 'draft'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'dermat_purchase_order_lines' })
@Index({ name: 'dermat_purchase_order_lines_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'dermat_purchase_order_lines_po_idx', properties: ['purchaseOrderId'] })
export class PurchaseOrderLine {
  [OptionalProps]?:
    | 'sequenceNumber'
    | 'pack'
    | 'freeQuantity'
    | 'componentCode'
    | 'mrp'
    | 'receivedQuantity'
    | 'qcApproved'
    | 'qcApprovedAt'
    | 'qcApprovedBy'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId!: string

  @Property({ name: 'line_kind', type: 'text' })
  lineKind!: PurchaseOrderLineKind

  @Property({ name: 'raw_material_id', type: 'uuid', nullable: true })
  rawMaterialId?: string | null

  @Property({ name: 'packaging_material_id', type: 'uuid', nullable: true })
  packagingMaterialId?: string | null

  @Property({ name: 'component_code', type: 'text', nullable: true })
  componentCode?: string | null

  @Property({ name: 'quantity', type: 'numeric', precision: 14, scale: 4 })
  quantity!: string

  @Property({ name: 'pack', type: 'numeric', precision: 14, scale: 4, nullable: true })
  pack?: string | null

  @Property({ name: 'free_quantity', type: 'numeric', precision: 14, scale: 4, default: '0' })
  freeQuantity: string = '0'

  @Property({ name: 'mrp', type: 'numeric', precision: 14, scale: 4, nullable: true })
  mrp?: string | null

  @Property({ type: 'text', default: 'kg' })
  unit: string = 'kg'

  // Received quantity is recorded here (partial receipts supported) but does NOT
  // increment master stock until qcApproved is set — matches the client's explicit
  // "raw material cannot be moved up and down" without QC approval requirement.
  @Property({ name: 'received_quantity', type: 'numeric', precision: 14, scale: 4, default: '0' })
  receivedQuantity: string = '0'

  @Property({ name: 'qc_approved', type: 'boolean', default: false })
  qcApproved: boolean = false

  @Property({ name: 'qc_approved_at', type: Date, nullable: true })
  qcApprovedAt?: Date | null

  @Property({ name: 'qc_approved_by', type: 'text', nullable: true })
  qcApprovedBy?: string | null

  @Property({ name: 'sequence_number', type: 'int', default: 0 })
  sequenceNumber: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'dermat_purchase_order_sequences' })
@Unique({
  name: 'dermat_po_sequences_org_tenant_fy_uq',
  properties: ['organizationId', 'tenantId', 'financialYear'],
})
export class PurchaseOrderNumberSequence {
  [OptionalProps]?: 'currentValue'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  // e.g. "2627" for FY Apr 2026 - Mar 2027.
  @Property({ name: 'financial_year', type: 'text' })
  financialYear!: string

  @Property({ name: 'current_value', type: 'int', default: 0 })
  currentValue: number = 0
}
