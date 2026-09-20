import { z } from 'zod'

const uuid = () => z.string().uuid()

const emptyStringToNull = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const clearableTextSchema = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().max(max).nullable().optional())

const scopedSchema = z.object({
  organizationId: uuid(),
  tenantId: uuid(),
})

export const PO_DEPARTMENTS = ['rm_store', 'pm_store'] as const
export const poDepartmentSchema = z.enum(PO_DEPARTMENTS)

export const PO_STATUSES = ['draft', 'issued', 'partially_received', 'received', 'cancelled'] as const
export const poStatusSchema = z.enum(PO_STATUSES)

export const purchaseOrderCreateSchema = scopedSchema.extend({
  department: poDepartmentSchema,
  vendorId: uuid(),
  bomId: uuid().nullable().optional(),
  gstNumber: clearableTextSchema(30),
  paymentTerms: clearableTextSchema(200),
  poDate: z.string().trim().min(1),
  deliveryDate: clearableTextSchema(20),
  billingAddress: clearableTextSchema(500),
  deliveryAddress: clearableTextSchema(500),
  status: poStatusSchema.optional(),
})

export const purchaseOrderUpdateSchema = z
  .object({ id: uuid() })
  .merge(purchaseOrderCreateSchema.partial())

export const purchaseOrderDeleteSchema = z.object({ id: uuid() })

export type PurchaseOrderCreateInput = z.infer<typeof purchaseOrderCreateSchema>
export type PurchaseOrderUpdateInput = z.infer<typeof purchaseOrderUpdateSchema>
export type PurchaseOrderDeleteInput = z.infer<typeof purchaseOrderDeleteSchema>

export const PO_LINE_KINDS = ['raw_material', 'packaging_material'] as const
export const poLineKindSchema = z.enum(PO_LINE_KINDS)

export const purchaseOrderLineCreateSchema = scopedSchema
  .extend({
    purchaseOrderId: uuid(),
    lineKind: poLineKindSchema,
    rawMaterialId: uuid().nullable().optional(),
    packagingMaterialId: uuid().nullable().optional(),
    componentCode: clearableTextSchema(120),
    quantity: z.coerce.number().positive(),
    pack: z.coerce.number().min(0).nullable().optional(),
    freeQuantity: z.coerce.number().min(0).optional().default(0),
    mrp: z.coerce.number().min(0).nullable().optional(),
    unit: z.string().trim().min(1).max(20).optional().default('kg'),
    sequenceNumber: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    const byKind: Record<(typeof PO_LINE_KINDS)[number], string | null | undefined> = {
      raw_material: value.rawMaterialId,
      packaging_material: value.packagingMaterialId,
    }
    for (const kind of PO_LINE_KINDS) {
      if (kind === value.lineKind) continue
      if (byKind[kind]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${kind === 'raw_material' ? 'rawMaterialId' : 'packagingMaterialId'} must not be set when lineKind is "${value.lineKind}"`,
          path: [kind === 'raw_material' ? 'rawMaterialId' : 'packagingMaterialId'],
        })
      }
    }
  })

export const purchaseOrderLineUpdateSchema = z.object({
  id: uuid(),
  purchaseOrderId: uuid().optional(),
  lineKind: poLineKindSchema.optional(),
  rawMaterialId: uuid().nullable().optional(),
  packagingMaterialId: uuid().nullable().optional(),
  componentCode: clearableTextSchema(120),
  quantity: z.coerce.number().positive().optional(),
  pack: z.coerce.number().min(0).nullable().optional(),
  freeQuantity: z.coerce.number().min(0).optional(),
  mrp: z.coerce.number().min(0).nullable().optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  receivedQuantity: z.coerce.number().min(0).optional(),
  qcApproved: z.boolean().optional(),
  qcApprovedBy: clearableTextSchema(200),
  sequenceNumber: z.coerce.number().int().min(0).optional(),
})

export const purchaseOrderLineDeleteSchema = z.object({ id: uuid() })

export type PurchaseOrderLineCreateInput = z.infer<typeof purchaseOrderLineCreateSchema>
export type PurchaseOrderLineUpdateInput = z.infer<typeof purchaseOrderLineUpdateSchema>
export type PurchaseOrderLineDeleteInput = z.infer<typeof purchaseOrderLineDeleteSchema>
