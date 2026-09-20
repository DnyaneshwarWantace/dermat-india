import { z } from 'zod'

const uuid = () => z.string().uuid()

export const PM_CATEGORIES = [
  'Carton',
  'Bottle',
  'Tube',
  'Label',
  'Leaflet',
  'Spatula',
  'Seal',
  'Box',
] as const

export const PM_UNITS = ['pcs', 'roll', 'kg'] as const

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

const nameSchema = z.string().trim().min(1).max(200)
const codeSchema = z.string().trim().max(50)
const unitSchema = z.string().trim().min(1).max(20)

const stockSchema = z.coerce.number().min(0).optional()

export const packagingMaterialCreateSchema = scopedSchema.extend({
  name: nameSchema,
  code: codeSchema.optional().default(''),
  stock: stockSchema,
  unit: unitSchema,
  makeBrandName: clearableTextSchema(200),
  supplier: clearableTextSchema(200),
  category: clearableTextSchema(100),
  dimensions: clearableTextSchema(100),
  isActive: z.boolean().optional(),
})

export const packagingMaterialUpdateSchema = z
  .object({
    id: uuid(),
  })
  .merge(packagingMaterialCreateSchema.partial())

export const packagingMaterialDeleteSchema = z.object({
  id: uuid(),
})

export type PackagingMaterialCreateInput = z.infer<typeof packagingMaterialCreateSchema>
export type PackagingMaterialUpdateInput = z.infer<typeof packagingMaterialUpdateSchema>
export type PackagingMaterialDeleteInput = z.infer<typeof packagingMaterialDeleteSchema>
