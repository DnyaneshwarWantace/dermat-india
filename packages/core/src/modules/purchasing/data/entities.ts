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

export type SupplierStatus = 'active' | 'inactive' | 'blocked'
export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'cancelled' | 'closed'
export type GoodsReceiptStatus = 'draft' | 'completed' | 'cancelled'
export type PurchaseOrderLineStatus = 'pending' | 'partially_received' | 'received' | 'cancelled'
export type PurchaseInvoiceStatus = 'draft' | 'pending_approval' | 'approved' | 'paid' | 'partially_paid' | 'cancelled'

type PurchasingOptionalProps = 'createdAt' | 'updatedAt' | 'deletedAt' | 'metadata'

abstract class PurchasingScopedEntity {
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

// ── Supplier ──────────────────────────────────────────────────────────────────

@Entity({ tableName: 'purchasing_suppliers' })
@Index({ name: 'purchasing_suppliers_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'purchasing_suppliers_org_code_unique_idx',
  expression:
    'create unique index "purchasing_suppliers_org_code_unique_idx" on "purchasing_suppliers" ("organization_id", "code") where deleted_at is null',
})
export class Supplier extends PurchasingScopedEntity {
  [OptionalProps]?: PurchasingOptionalProps | 'isActive' | 'status'

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text' })
  code!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'text', default: 'active' })
  status: SupplierStatus = 'active'

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'contact_name', type: 'text', nullable: true })
  contactName?: string | null

  @Property({ name: 'contact_email', type: 'text', nullable: true })
  contactEmail?: string | null

  @Property({ name: 'contact_phone', type: 'text', nullable: true })
  contactPhone?: string | null

  @Property({ type: 'text', nullable: true })
  website?: string | null

  @Property({ name: 'tax_id', type: 'text', nullable: true })
  taxId?: string | null

  @Property({ name: 'address_line1', type: 'text', nullable: true })
  addressLine1?: string | null

  @Property({ name: 'address_line2', type: 'text', nullable: true })
  addressLine2?: string | null

  @Property({ type: 'text', nullable: true })
  city?: string | null

  @Property({ type: 'text', nullable: true })
  state?: string | null

  @Property({ name: 'postal_code', type: 'text', nullable: true })
  postalCode?: string | null

  @Property({ type: 'text', nullable: true })
  country?: string | null

  @Property({ name: 'currency_code', type: 'text', nullable: true })
  currencyCode?: string | null

  @Property({ name: 'payment_terms', type: 'text', nullable: true })
  paymentTerms?: string | null

  @Property({ name: 'lead_time_days', type: 'integer', nullable: true })
  leadTimeDays?: number | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @OneToMany(() => PurchaseOrder, (po) => po.supplier)
  purchaseOrders = new Collection<PurchaseOrder>(this)

  @OneToMany(() => SupplierPricing, (sp) => sp.supplier)
  pricingRules = new Collection<SupplierPricing>(this)
}

// ── Supplier Pricing ─────────────────────────────────────────────────────────

@Entity({ tableName: 'purchasing_supplier_pricing' })
@Index({ name: 'purchasing_sp_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'purchasing_sp_supplier_idx', properties: ['supplier'] })
@Index({ name: 'purchasing_sp_product_idx', properties: ['organizationId', 'productVariantId'] })
export class SupplierPricing extends PurchasingScopedEntity {
  [OptionalProps]?: PurchasingOptionalProps | 'minQuantity' | 'isActive'

  @ManyToOne(() => Supplier, { fieldName: 'supplier_id' })
  supplier!: Supplier

  @Property({ name: 'product_variant_id', type: 'uuid' })
  productVariantId!: string

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'product_sku', type: 'text', nullable: true })
  productSku?: string | null

  @Property({ name: 'unit_price_cents', type: 'bigint' })
  unitPriceCents!: number

  @Property({ name: 'currency_code', type: 'text', nullable: true })
  currencyCode?: string | null

  @Property({ name: 'min_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '1' })
  minQuantity: string = '1'

  @Property({ name: 'lead_time_days', type: 'integer', nullable: true })
  leadTimeDays?: number | null

  @Property({ name: 'valid_from', type: Date, nullable: true })
  validFrom?: Date | null

  @Property({ name: 'valid_to', type: Date, nullable: true })
  validTo?: Date | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}

// ── Purchase Order ────────────────────────────────────────────────────────────

@Entity({ tableName: 'purchasing_purchase_orders' })
@Index({ name: 'purchasing_po_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'purchasing_po_org_number_unique_idx',
  expression:
    'create unique index "purchasing_po_org_number_unique_idx" on "purchasing_purchase_orders" ("organization_id", "order_number") where deleted_at is null',
})
@Index({ name: 'purchasing_po_supplier_idx', properties: ['supplier'] })
@Index({ name: 'purchasing_po_status_idx', properties: ['organizationId', 'status'] })
export class PurchaseOrder extends PurchasingScopedEntity {
  [OptionalProps]?: PurchasingOptionalProps | 'status' | 'subtotalCents' | 'taxCents' | 'totalCents'

  @Property({ name: 'order_number', type: 'text' })
  orderNumber!: string

  @ManyToOne(() => Supplier, { fieldName: 'supplier_id' })
  supplier!: Supplier

  @Property({ type: 'text', default: 'draft' })
  status: PurchaseOrderStatus = 'draft'

  @Property({ name: 'order_date', type: Date })
  orderDate!: Date

  @Property({ name: 'expected_delivery_date', type: Date, nullable: true })
  expectedDeliveryDate?: Date | null

  @Property({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId?: string | null

  @Property({ name: 'currency_code', type: 'text', nullable: true })
  currencyCode?: string | null

  @Property({ name: 'subtotal_cents', type: 'bigint', default: 0 })
  subtotalCents: number = 0

  @Property({ name: 'tax_cents', type: 'bigint', default: 0 })
  taxCents: number = 0

  @Property({ name: 'total_cents', type: 'bigint', default: 0 })
  totalCents: number = 0

  @Property({ name: 'payment_terms', type: 'text', nullable: true })
  paymentTerms?: string | null

  @Property({ name: 'shipping_method', type: 'text', nullable: true })
  shippingMethod?: string | null

  @Property({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string | null

  @Property({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId?: string | null

  @Property({ name: 'approved_at', type: Date, nullable: true })
  approvedAt?: Date | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @OneToMany(() => PurchaseOrderLine, (line) => line.purchaseOrder)
  lines = new Collection<PurchaseOrderLine>(this)

  @OneToMany(() => GoodsReceipt, (gr) => gr.purchaseOrder)
  goodsReceipts = new Collection<GoodsReceipt>(this)
}

// ── Purchase Order Line ───────────────────────────────────────────────────────

@Entity({ tableName: 'purchasing_purchase_order_lines' })
@Index({ name: 'purchasing_pol_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'purchasing_pol_po_idx', properties: ['purchaseOrder'] })
@Index({ name: 'purchasing_pol_product_idx', properties: ['organizationId', 'productVariantId'] })
export class PurchaseOrderLine extends PurchasingScopedEntity {
  [OptionalProps]?: PurchasingOptionalProps | 'status' | 'receivedQuantity' | 'lineTotal'

  @ManyToOne(() => PurchaseOrder, { fieldName: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder

  @Property({ name: 'line_number', type: 'integer' })
  lineNumber!: number

  @Property({ name: 'product_variant_id', type: 'uuid', nullable: true })
  productVariantId?: string | null

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'product_sku', type: 'text', nullable: true })
  productSku?: string | null

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'numeric', columnType: 'numeric(15,4)' })
  quantity!: string

  @Property({ name: 'unit_of_measure', type: 'text', nullable: true })
  unitOfMeasure?: string | null

  @Property({ name: 'unit_price_cents', type: 'bigint' })
  unitPriceCents!: number

  @Property({ name: 'line_total', type: 'bigint', default: 0 })
  lineTotal: number = 0

  @Property({ name: 'tax_rate', type: 'numeric', columnType: 'numeric(5,2)', nullable: true })
  taxRate?: string | null

  @Property({ name: 'received_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  receivedQuantity: string = '0'

  @Property({ type: 'text', default: 'pending' })
  status: PurchaseOrderLineStatus = 'pending'

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}

// ── Goods Receipt ─────────────────────────────────────────────────────────────

@Entity({ tableName: 'purchasing_goods_receipts' })
@Index({ name: 'purchasing_gr_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'purchasing_gr_org_number_unique_idx',
  expression:
    'create unique index "purchasing_gr_org_number_unique_idx" on "purchasing_goods_receipts" ("organization_id", "receipt_number") where deleted_at is null',
})
@Index({ name: 'purchasing_gr_po_idx', properties: ['purchaseOrder'] })
export class GoodsReceipt extends PurchasingScopedEntity {
  [OptionalProps]?: PurchasingOptionalProps | 'status'

  @Property({ name: 'receipt_number', type: 'text' })
  receiptNumber!: string

  @ManyToOne(() => PurchaseOrder, { fieldName: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder

  @Property({ type: 'text', default: 'draft' })
  status: GoodsReceiptStatus = 'draft'

  @Property({ name: 'receipt_date', type: Date })
  receiptDate!: Date

  @Property({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId?: string | null

  @Property({ name: 'received_by_user_id', type: 'uuid', nullable: true })
  receivedByUserId?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @OneToMany(() => GoodsReceiptLine, (line) => line.goodsReceipt)
  lines = new Collection<GoodsReceiptLine>(this)
}

// ── Goods Receipt Line ────────────────────────────────────────────────────────

@Entity({ tableName: 'purchasing_goods_receipt_lines' })
@Index({ name: 'purchasing_grl_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'purchasing_grl_gr_idx', properties: ['goodsReceipt'] })
@Index({ name: 'purchasing_grl_pol_idx', properties: ['purchaseOrderLineId'] })
export class GoodsReceiptLine extends PurchasingScopedEntity {
  [OptionalProps]?: PurchasingOptionalProps | 'acceptedQuantity' | 'rejectedQuantity'

  @ManyToOne(() => GoodsReceipt, { fieldName: 'goods_receipt_id' })
  goodsReceipt!: GoodsReceipt

  @Property({ name: 'purchase_order_line_id', type: 'uuid' })
  purchaseOrderLineId!: string

  @Property({ name: 'product_variant_id', type: 'uuid', nullable: true })
  productVariantId?: string | null

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ name: 'received_quantity', type: 'numeric', columnType: 'numeric(15,4)' })
  receivedQuantity!: string

  @Property({ name: 'accepted_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  acceptedQuantity: string = '0'

  @Property({ name: 'rejected_quantity', type: 'numeric', columnType: 'numeric(15,4)', default: '0' })
  rejectedQuantity: string = '0'

  @Property({ name: 'batch_number', type: 'text', nullable: true })
  batchNumber?: string | null

  @Property({ name: 'lot_number', type: 'text', nullable: true })
  lotNumber?: string | null

  @Property({ name: 'expiry_date', type: Date, nullable: true })
  expiryDate?: Date | null

  @Property({ name: 'warehouse_location_id', type: 'uuid', nullable: true })
  warehouseLocationId?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}

// ── Purchase Invoice ─────────────────────────────────────────────────────────

@Entity({ tableName: 'purchasing_purchase_invoices' })
@Index({ name: 'purchasing_pi_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({
  name: 'purchasing_pi_org_number_unique_idx',
  expression:
    'create unique index "purchasing_pi_org_number_unique_idx" on "purchasing_purchase_invoices" ("organization_id", "invoice_number") where deleted_at is null',
})
@Index({ name: 'purchasing_pi_supplier_idx', properties: ['supplierId'] })
@Index({ name: 'purchasing_pi_po_idx', properties: ['purchaseOrderId'] })
export class PurchaseInvoice extends PurchasingScopedEntity {
  [OptionalProps]?: PurchasingOptionalProps | 'status' | 'subtotalCents' | 'taxCents' | 'totalCents' | 'paidCents' | 'balanceCents'

  @Property({ name: 'invoice_number', type: 'text' })
  invoiceNumber!: string

  @Property({ name: 'supplier_invoice_number', type: 'text', nullable: true })
  supplierInvoiceNumber?: string | null

  @Property({ name: 'supplier_id', type: 'uuid' })
  supplierId!: string

  @Property({ name: 'purchase_order_id', type: 'uuid', nullable: true })
  purchaseOrderId?: string | null

  @Property({ name: 'goods_receipt_id', type: 'uuid', nullable: true })
  goodsReceiptId?: string | null

  @Property({ type: 'text', default: 'draft' })
  status: PurchaseInvoiceStatus = 'draft'

  @Property({ name: 'invoice_date', type: Date })
  invoiceDate!: Date

  @Property({ name: 'due_date', type: Date, nullable: true })
  dueDate?: Date | null

  @Property({ name: 'currency_code', type: 'text', nullable: true })
  currencyCode?: string | null

  @Property({ name: 'subtotal_cents', type: 'bigint', default: 0 })
  subtotalCents: number = 0

  @Property({ name: 'tax_cents', type: 'bigint', default: 0 })
  taxCents: number = 0

  @Property({ name: 'total_cents', type: 'bigint', default: 0 })
  totalCents: number = 0

  @Property({ name: 'paid_cents', type: 'bigint', default: 0 })
  paidCents: number = 0

  @Property({ name: 'balance_cents', type: 'bigint', default: 0 })
  balanceCents: number = 0

  @Property({ name: 'payment_terms', type: 'text', nullable: true })
  paymentTerms?: string | null

  @Property({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId?: string | null

  @Property({ name: 'approved_at', type: Date, nullable: true })
  approvedAt?: Date | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @OneToMany(() => PurchaseInvoiceLine, (line) => line.purchaseInvoice)
  lines = new Collection<PurchaseInvoiceLine>(this)
}

// ── Purchase Invoice Line ────────────────────────────────────────────────────

@Entity({ tableName: 'purchasing_purchase_invoice_lines' })
@Index({ name: 'purchasing_pil_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'purchasing_pil_pi_idx', properties: ['purchaseInvoice'] })
export class PurchaseInvoiceLine extends PurchasingScopedEntity {
  [OptionalProps]?: PurchasingOptionalProps | 'lineTotal'

  @ManyToOne(() => PurchaseInvoice, { fieldName: 'purchase_invoice_id' })
  purchaseInvoice!: PurchaseInvoice

  @Property({ name: 'purchase_order_line_id', type: 'uuid', nullable: true })
  purchaseOrderLineId?: string | null

  @Property({ name: 'line_number', type: 'integer' })
  lineNumber!: number

  @Property({ name: 'product_variant_id', type: 'uuid', nullable: true })
  productVariantId?: string | null

  @Property({ name: 'product_name', type: 'text' })
  productName!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'numeric', columnType: 'numeric(15,4)' })
  quantity!: string

  @Property({ name: 'unit_of_measure', type: 'text', nullable: true })
  unitOfMeasure?: string | null

  @Property({ name: 'unit_price_cents', type: 'bigint' })
  unitPriceCents!: number

  @Property({ name: 'line_total', type: 'bigint', default: 0 })
  lineTotal: number = 0

  @Property({ name: 'tax_rate', type: 'numeric', columnType: 'numeric(5,2)', nullable: true })
  taxRate?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null
}
