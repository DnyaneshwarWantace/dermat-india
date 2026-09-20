import { z } from 'zod'

const uuid = () => z.string().uuid()

const emptyStringToNull = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const clearableStringSchema = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().max(max).nullable().optional())

const clearableEmailSchema = z.preprocess(
  emptyStringToNull,
  z.string().email().max(320).nullable().optional(),
)

const scopedSchema = z.object({
  organizationId: uuid(),
  tenantId: uuid(),
})

// ── Supplier ──────────────────────────────────────────────────────────────────

export const createSupplierSchema = scopedSchema.extend({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  description: clearableStringSchema(2000),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  contactName: clearableStringSchema(200),
  contactEmail: clearableEmailSchema,
  contactPhone: clearableStringSchema(50),
  website: clearableStringSchema(300),
  taxId: clearableStringSchema(100),
  addressLine1: clearableStringSchema(300),
  addressLine2: clearableStringSchema(300),
  city: clearableStringSchema(100),
  state: clearableStringSchema(100),
  postalCode: clearableStringSchema(20),
  country: clearableStringSchema(100),
  currencyCode: clearableStringSchema(10),
  paymentTerms: clearableStringSchema(200),
  leadTimeDays: z.coerce.number().int().min(0).nullable().optional(),
  notes: clearableStringSchema(5000),
})

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
})

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>

export const deleteSupplierSchema = scopedSchema.extend({
  id: uuid(),
})

// ── Purchase Order ────────────────────────────────────────────────────────────

export const purchaseOrderLineSchema = z.object({
  lineNumber: z.coerce.number().int().min(1),
  productVariantId: uuid().nullable().optional(),
  productName: z.string().trim().min(1).max(300),
  productSku: clearableStringSchema(100),
  description: clearableStringSchema(2000),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity'),
  unitOfMeasure: clearableStringSchema(50),
  unitPriceCents: z.coerce.number().int().min(0),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  notes: clearableStringSchema(2000),
})

export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineSchema>

export const createPurchaseOrderSchema = scopedSchema.extend({
  supplierId: uuid(),
  orderDate: z.coerce.date(),
  expectedDeliveryDate: z.coerce.date().nullable().optional(),
  warehouseId: uuid().nullable().optional(),
  currencyCode: clearableStringSchema(10),
  paymentTerms: clearableStringSchema(200),
  shippingMethod: clearableStringSchema(200),
  notes: clearableStringSchema(5000),
  lines: z.array(purchaseOrderLineSchema).min(1),
})

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>

export const updatePurchaseOrderSchema = z.object({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
  supplierId: uuid().optional(),
  status: z.enum(['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled', 'closed']).optional(),
  orderDate: z.coerce.date().optional(),
  expectedDeliveryDate: z.coerce.date().nullable().optional(),
  warehouseId: uuid().nullable().optional(),
  currencyCode: clearableStringSchema(10),
  paymentTerms: clearableStringSchema(200),
  shippingMethod: clearableStringSchema(200),
  notes: clearableStringSchema(5000),
  lines: z.array(purchaseOrderLineSchema).optional(),
})

export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>

export const deletePurchaseOrderSchema = scopedSchema.extend({
  id: uuid(),
})

// ── Goods Receipt ─────────────────────────────────────────────────────────────

export const goodsReceiptLineSchema = z.object({
  purchaseOrderLineId: uuid(),
  productVariantId: uuid().nullable().optional(),
  productName: z.string().trim().min(1).max(300),
  receivedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity'),
  acceptedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity').optional(),
  rejectedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity').optional(),
  batchNumber: clearableStringSchema(100),
  lotNumber: clearableStringSchema(100),
  expiryDate: z.coerce.date().nullable().optional(),
  warehouseLocationId: uuid().nullable().optional(),
  notes: clearableStringSchema(2000),
})

export type GoodsReceiptLineInput = z.infer<typeof goodsReceiptLineSchema>

export const createGoodsReceiptSchema = scopedSchema.extend({
  purchaseOrderId: uuid(),
  receiptDate: z.coerce.date(),
  warehouseId: uuid().nullable().optional(),
  notes: clearableStringSchema(5000),
  lines: z.array(goodsReceiptLineSchema).min(1),
})

export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>

export const updateGoodsReceiptSchema = z.object({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
  status: z.enum(['draft', 'completed', 'cancelled']).optional(),
  receiptDate: z.coerce.date().optional(),
  warehouseId: uuid().nullable().optional(),
  notes: clearableStringSchema(5000),
  lines: z.array(goodsReceiptLineSchema).optional(),
})

export type UpdateGoodsReceiptInput = z.infer<typeof updateGoodsReceiptSchema>

export const deleteGoodsReceiptSchema = scopedSchema.extend({
  id: uuid(),
})

// ── Supplier Pricing ─────────────────────────────────────────────────────────

export const createSupplierPricingSchema = scopedSchema.extend({
  supplierId: uuid(),
  productVariantId: uuid(),
  productName: z.string().trim().min(1).max(300),
  productSku: clearableStringSchema(100),
  unitPriceCents: z.coerce.number().int().min(0),
  currencyCode: clearableStringSchema(10),
  minQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity').default('1'),
  leadTimeDays: z.coerce.number().int().min(0).nullable().optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validTo: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
  notes: clearableStringSchema(5000),
})

export type CreateSupplierPricingInput = z.infer<typeof createSupplierPricingSchema>

export const updateSupplierPricingSchema = createSupplierPricingSchema.partial().extend({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
})

export type UpdateSupplierPricingInput = z.infer<typeof updateSupplierPricingSchema>

export const deleteSupplierPricingSchema = scopedSchema.extend({
  id: uuid(),
})

// ── Purchase Invoice ─────────────────────────────────────────────────────────

export const purchaseInvoiceLineSchema = z.object({
  purchaseOrderLineId: uuid().nullable().optional(),
  lineNumber: z.coerce.number().int().min(1),
  productVariantId: uuid().nullable().optional(),
  productName: z.string().trim().min(1).max(300),
  description: clearableStringSchema(2000),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity'),
  unitOfMeasure: clearableStringSchema(50),
  unitPriceCents: z.coerce.number().int().min(0),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  notes: clearableStringSchema(2000),
})

export type PurchaseInvoiceLineInput = z.infer<typeof purchaseInvoiceLineSchema>

export const createPurchaseInvoiceSchema = scopedSchema.extend({
  supplierId: uuid(),
  purchaseOrderId: uuid().nullable().optional(),
  goodsReceiptId: uuid().nullable().optional(),
  supplierInvoiceNumber: clearableStringSchema(200),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().nullable().optional(),
  currencyCode: clearableStringSchema(10),
  paymentTerms: clearableStringSchema(200),
  notes: clearableStringSchema(5000),
  lines: z.array(purchaseInvoiceLineSchema).min(1),
})

export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>

export const updatePurchaseInvoiceSchema = z.object({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
  supplierId: uuid().optional(),
  purchaseOrderId: uuid().nullable().optional(),
  goodsReceiptId: uuid().nullable().optional(),
  supplierInvoiceNumber: clearableStringSchema(200),
  status: z.enum(['draft', 'pending_approval', 'approved', 'paid', 'partially_paid', 'cancelled']).optional(),
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  currencyCode: clearableStringSchema(10),
  paymentTerms: clearableStringSchema(200),
  notes: clearableStringSchema(5000),
  lines: z.array(purchaseInvoiceLineSchema).optional(),
})

export type UpdatePurchaseInvoiceInput = z.infer<typeof updatePurchaseInvoiceSchema>

export const deletePurchaseInvoiceSchema = scopedSchema.extend({
  id: uuid(),
})
