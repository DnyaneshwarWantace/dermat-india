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

const bomNameSchema = z.string().trim().min(1).max(200)

export const bomCreateSchema = scopedSchema.extend({
  bomName: bomNameSchema,
  catalogProductId: uuid().nullable().optional(),
  batchQuantity: z.coerce.number().positive().optional(),
  version: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
})

export const bomUpdateSchema = z
  .object({
    id: uuid(),
  })
  .merge(bomCreateSchema.partial())

export const bomDeleteSchema = z.object({
  id: uuid(),
})

export type BomCreateInput = z.infer<typeof bomCreateSchema>
export type BomUpdateInput = z.infer<typeof bomUpdateSchema>
export type BomDeleteInput = z.infer<typeof bomDeleteSchema>

export const BOM_COMPONENT_KINDS = ['raw_material', 'packaging_material'] as const

export const bomComponentKindSchema = z.enum(BOM_COMPONENT_KINDS)

// Exactly one of rawMaterialId/packagingMaterialId must be set, matching componentKind
// — enforced here so a malformed payload is rejected before it reaches the command layer.
export const bomLineCreateSchema = scopedSchema
  .extend({
    bomId: uuid(),
    componentKind: bomComponentKindSchema,
    rawMaterialId: uuid().nullable().optional(),
    packagingMaterialId: uuid().nullable().optional(),
    componentCode: clearableTextSchema(120),
    qtyPerUnit: z.coerce.number().min(0),
    wastagePercent: z.coerce.number().min(0).max(100).optional().default(0),
    unit: z.string().trim().min(1).max(20).optional().default('kg'),
    rmPercent: z.coerce.number().min(0).max(100).nullable().optional(),
    sequenceNumber: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    // A newly-added row may be created with no reference yet and filled in via the
    // detail page's inline picker immediately after — so an empty reference is valid
    // on create. What's rejected is a MISMATCHED reference (e.g. packagingMaterialId
    // set while componentKind is "raw_material").
    const byKind: Record<(typeof BOM_COMPONENT_KINDS)[number], string | null | undefined> = {
      raw_material: value.rawMaterialId,
      packaging_material: value.packagingMaterialId,
    }
    for (const kind of BOM_COMPONENT_KINDS) {
      if (kind === value.componentKind) continue
      if (byKind[kind]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${kind === 'raw_material' ? 'rawMaterialId' : 'packagingMaterialId'} must not be set when componentKind is "${value.componentKind}"`,
          path: [kind === 'raw_material' ? 'rawMaterialId' : 'packagingMaterialId'],
        })
      }
    }
  })

export const bomLineUpdateSchema = z.object({
  id: uuid(),
  bomId: uuid().optional(),
  componentKind: bomComponentKindSchema.optional(),
  rawMaterialId: uuid().nullable().optional(),
  packagingMaterialId: uuid().nullable().optional(),
  componentCode: clearableTextSchema(120),
  qtyPerUnit: z.coerce.number().min(0).optional(),
  wastagePercent: z.coerce.number().min(0).max(100).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  rmPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  sequenceNumber: z.coerce.number().int().min(0).optional(),
})

export const bomLineDeleteSchema = z.object({
  id: uuid(),
})

export type BomLineCreateInput = z.infer<typeof bomLineCreateSchema>
export type BomLineUpdateInput = z.infer<typeof bomLineUpdateSchema>
export type BomLineDeleteInput = z.infer<typeof bomLineDeleteSchema>
