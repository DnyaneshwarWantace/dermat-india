import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { OptionalProps } from '@mikro-orm/core'

export type OrderStatus = 'booked' | 'confirmed' | 'completed' | 'cancelled'
export type OrderType = 'new' | 'repeat' | 'revision'
export type OrderPriority = 'normal' | 'urgent'

export type FieldChange = { key: string; label: string; from: string | number | null; to: string | number | null }

@Entity({ tableName: 'dermat_orders' })
@Index({ name: 'dermat_orders_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'dermat_orders_customer_idx', properties: ['customerId'] })
@Unique({ name: 'dermat_orders_org_no_uq', properties: ['organizationId', 'tenantId', 'orderNo'] })
export class DermatOrder {
  [OptionalProps]?:
    | 'status'
    | 'orderType'
    | 'deliveryDate'
    | 'customerPoRef'
    | 'sourceOrderId'
    | 'salesManager'
    | 'coordinator'
    | 'paymentTerms'
    | 'paymentRemarks'
    | 'productRemarks'
    | 'billingRemarks'
    | 'packingRemarks'
    | 'pricesIncludeGst'
    | 'priority'
    | 'billingAddress'
    | 'shippingAddress'
    | 'revisedAt'
    | 'revisedByName'
    | 'revisionNote'
    | 'createdByName'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'order_no', type: 'text' })
  orderNo!: string

  @Property({ name: 'order_date', type: 'date' })
  orderDate!: string

  @Property({ name: 'delivery_date', type: 'date', nullable: true })
  deliveryDate?: string | null

  @Property({ name: 'customer_id', type: 'uuid' })
  customerId!: string

  @Property({ name: 'customer_po_ref', type: 'text', nullable: true })
  customerPoRef?: string | null

  @Property({ name: 'order_type', type: 'text', default: 'new' })
  orderType: OrderType = 'new'

  @Property({ name: 'source_order_id', type: 'uuid', nullable: true })
  sourceOrderId?: string | null

  @Property({ name: 'sales_manager', type: 'text', nullable: true })
  salesManager?: string | null

  @Property({ type: 'text', nullable: true })
  coordinator?: string | null

  @Property({ name: 'payment_terms', type: 'text', nullable: true })
  paymentTerms?: string | null

  @Property({ name: 'payment_remarks', type: 'text', nullable: true })
  paymentRemarks?: string | null

  @Property({ name: 'product_remarks', type: 'text', nullable: true })
  productRemarks?: string | null

  @Property({ name: 'billing_remarks', type: 'text', nullable: true })
  billingRemarks?: string | null

  @Property({ name: 'packing_remarks', type: 'text', nullable: true })
  packingRemarks?: string | null

  @Property({ name: 'prices_include_gst', type: 'boolean', default: false })
  pricesIncludeGst: boolean = false

  @Property({ type: 'text', default: 'booked' })
  status: OrderStatus = 'booked'

  @Property({ type: 'text', default: 'normal' })
  priority: OrderPriority = 'normal'

  @Property({ name: 'billing_address', type: 'text', nullable: true })
  billingAddress?: string | null

  @Property({ name: 'shipping_address', type: 'text', nullable: true })
  shippingAddress?: string | null

  @Property({ name: 'revised_at', type: Date, nullable: true })
  revisedAt?: Date | null

  @Property({ name: 'revised_by_name', type: 'text', nullable: true })
  revisedByName?: string | null

  @Property({ name: 'revision_note', type: 'text', nullable: true })
  revisionNote?: string | null

  @Property({ name: 'created_by_name', type: 'text', nullable: true })
  createdByName?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'dermat_order_lines' })
@Index({ name: 'dermat_order_lines_order_idx', properties: ['orderId'] })
@Index({ name: 'dermat_order_lines_product_idx', properties: ['productId'] })
export class DermatOrderLine {
  [OptionalProps]?: 'brandName' | 'packSize' | 'mrp' | 'rate' | 'gstPercent' | 'discountPercent' | 'batchNo' | 'sampleNeeded' | 'sameAsProductId' | 'rdNumber' | 'specs' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Property({ type: 'int' })
  position!: number

  @Property({ name: 'product_id', type: 'uuid' })
  productId!: string

  @Property({ name: 'brand_name', type: 'text', nullable: true })
  brandName?: string | null

  @Property({ name: 'pack_size', type: 'text', nullable: true })
  packSize?: string | null

  @Property({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  mrp?: string | null

  @Property({ type: 'numeric', precision: 14, scale: 3 })
  quantity!: string

  @Property({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  rate?: string | null

  @Property({ name: 'gst_percent', type: 'numeric', precision: 6, scale: 2, default: '18' })
  gstPercent: string = '18'

  @Property({ name: 'discount_percent', type: 'numeric', precision: 6, scale: 2, default: '0' })
  discountPercent: string = '0'

  @Property({ name: 'batch_no', type: 'text', nullable: true })
  batchNo?: string | null

  @Property({ name: 'sample_needed', type: 'boolean', default: false })
  sampleNeeded: boolean = false

  @Property({ name: 'same_as_product_id', type: 'uuid', nullable: true })
  sameAsProductId?: string | null

  @Property({ name: 'rd_number', type: 'text', nullable: true })
  rdNumber?: string | null

  @Property({ type: 'json', nullable: true })
  specs?: Record<string, Record<string, string>> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'dermat_order_stages' })
@Index({ name: 'dermat_order_stages_order_idx', properties: ['orderId'] })
@Index({ name: 'dermat_order_stages_open_idx', properties: ['tenantId', 'organizationId', 'status'] })
@Unique({ name: 'dermat_order_stages_order_key_uq', properties: ['orderId', 'stageKey'] })
export class DermatOrderStage {
  [OptionalProps]?:
    | 'status'
    | 'responsibleUserId'
    | 'responsibleName'
    | 'data'
    | 'holdReason'
    | 'holdParty'
    | 'openedAt'
    | 'completedAt'
    | 'completedByName'
    | 'createdAt'
    | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Property({ name: 'stage_key', type: 'text' })
  stageKey!: string

  @Property({ type: 'text', default: 'waiting' })
  status: string = 'waiting'

  @Property({ name: 'responsible_user_id', type: 'uuid', nullable: true })
  responsibleUserId?: string | null

  @Property({ name: 'responsible_name', type: 'text', nullable: true })
  responsibleName?: string | null

  @Property({ type: 'json', nullable: true })
  data?: Record<string, unknown> | null

  @Property({ name: 'hold_reason', type: 'text', nullable: true })
  holdReason?: string | null

  @Property({ name: 'hold_party', type: 'text', nullable: true })
  holdParty?: string | null

  @Property({ name: 'opened_at', type: Date, nullable: true })
  openedAt?: Date | null

  @Property({ name: 'completed_at', type: Date, nullable: true })
  completedAt?: Date | null

  @Property({ name: 'completed_by_name', type: 'text', nullable: true })
  completedByName?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'dermat_order_events' })
@Index({ name: 'dermat_order_events_order_idx', properties: ['orderId'] })
export class DermatOrderEvent {
  [OptionalProps]?: 'stageKey' | 'stepKey' | 'note' | 'byName' | 'changes' | 'createdAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Property({ name: 'stage_key', type: 'text', nullable: true })
  stageKey?: string | null

  @Property({ name: 'step_key', type: 'text', nullable: true })
  stepKey?: string | null

  @Property({ type: 'text' })
  action!: string

  @Property({ type: 'text', nullable: true })
  note?: string | null

  @Property({ name: 'by_name', type: 'text', nullable: true })
  byName?: string | null

  @Property({ type: 'json', nullable: true })
  changes?: FieldChange[] | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

export type CardSettings = {
  owners?: Record<string, string[]>
  people?: Record<string, { userId: string; name: string | null }>
  fields?: Record<string, string>
  documents?: Record<string, string>
  labels?: Record<string, string>
  extraSteps?: Array<{ key: string; label: string; after: string | null; optional?: boolean }>
}

@Entity({ tableName: 'dermat_stage_settings' })
@Unique({ name: 'dermat_stage_settings_scope_uq', properties: ['organizationId', 'tenantId', 'stageKey'] })
export class DermatStageSetting {
  [OptionalProps]?: 'label' | 'dayLimit' | 'reopenHours' | 'hiddenSteps' | 'requiredFields' | 'extraFields' | 'documents' | 'extraDocuments' | 'sharedFields' | 'cardSettings' | 'updatedByName' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'stage_key', type: 'text' })
  stageKey!: string

  @Property({ type: 'text', nullable: true })
  label?: string | null

  @Property({ name: 'day_limit', type: 'integer', nullable: true })
  dayLimit?: number | null

  @Property({ name: 'reopen_hours', type: 'integer', nullable: true })
  reopenHours?: number | null

  @Property({ name: 'hidden_steps', type: 'json', nullable: true })
  hiddenSteps?: string[] | null

  @Property({ name: 'required_fields', type: 'json', nullable: true })
  requiredFields?: string[] | null

  @Property({ name: 'extra_fields', type: 'json', nullable: true })
  extraFields?: Array<{ key: string; label: string; type: string; options?: string[]; required?: boolean }> | null

  @Property({ type: 'json', nullable: true })
  documents?: Record<string, 'always' | 'optional'> | null

  @Property({ name: 'extra_documents', type: 'json', nullable: true })
  extraDocuments?: Array<{ key: string; label: string; required: boolean }> | null

  @Property({ name: 'shared_fields', type: 'json', nullable: true })
  sharedFields?: string[] | null

  @Property({ name: 'card_settings', type: 'json', nullable: true })
  cardSettings?: CardSettings | null

  @Property({ name: 'updated_by_name', type: 'text', nullable: true })
  updatedByName?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'dermat_artwork_approvals' })
@Index({ name: 'dermat_artwork_approvals_order_idx', properties: ['organizationId', 'tenantId', 'orderId'] })
@Unique({ name: 'dermat_artwork_approvals_token_uq', properties: ['tokenHash'] })
export class DermatArtworkApproval {
  [OptionalProps]?: 'status' | 'fileIds' | 'clientName' | 'clientDesignation' | 'signature' | 'comments' | 'ip' | 'userAgent' | 'decidedAt' | 'createdByName' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'order_id', type: 'uuid' })
  orderId!: string

  @Property({ name: 'token_hash', type: 'text' })
  tokenHash!: string

  @Property({ type: 'text', default: 'open' })
  status: 'open' | 'approved' | 'changes' | 'closed' = 'open'

  @Property({ name: 'file_ids', type: 'json', nullable: true })
  fileIds?: string[] | null

  @Property({ name: 'client_name', type: 'text', nullable: true })
  clientName?: string | null

  @Property({ name: 'client_designation', type: 'text', nullable: true })
  clientDesignation?: string | null

  @Property({ type: 'text', nullable: true })
  signature?: string | null

  @Property({ type: 'text', nullable: true })
  comments?: string | null

  @Property({ type: 'text', nullable: true })
  ip?: string | null

  @Property({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null

  @Property({ name: 'decided_at', type: Date, nullable: true })
  decidedAt?: Date | null

  @Property({ name: 'expires_at', type: Date })
  expiresAt!: Date

  @Property({ name: 'created_by_name', type: 'text', nullable: true })
  createdByName?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

export type DocLinkKind = 'pi' | 'invoice' | 'po' | 'dispatch' | 'sample'
export type DocLinkSend = { via: 'email' | 'whatsapp' | 'copy'; by: string | null; at: string; to: string | null }

@Entity({ tableName: 'dermat_doc_links' })
@Index({ name: 'dermat_doc_links_record_idx', properties: ['organizationId', 'tenantId', 'kind', 'recordId'] })
@Unique({ name: 'dermat_doc_links_token_uq', properties: ['token'] })
export class DermatDocLink {
  [OptionalProps]?: 'orderId' | 'customerId' | 'sends' | 'openedCount' | 'lastOpenedAt' | 'revokedAt' | 'createdByName' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  token!: string

  @Property({ type: 'text' })
  kind!: DocLinkKind

  @Property({ name: 'record_id', type: 'uuid' })
  recordId!: string

  @Property({ name: 'order_id', type: 'uuid', nullable: true })
  orderId?: string | null

  @Property({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string | null

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'json', nullable: true })
  sends?: DocLinkSend[] | null

  @Property({ name: 'opened_count', type: 'integer', default: 0 })
  openedCount: number = 0

  @Property({ name: 'last_opened_at', type: Date, nullable: true })
  lastOpenedAt?: Date | null

  @Property({ name: 'revoked_at', type: Date, nullable: true })
  revokedAt?: Date | null

  @Property({ name: 'created_by_name', type: 'text', nullable: true })
  createdByName?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
