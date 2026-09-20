import { z } from 'zod'

const uuid = () => z.string().uuid()

export const RM_BENEFIT_TAGS = [
  'Brightening',
  'Growth',
  'Soothing',
  'Moisturizing',
  'Cleansing',
  'Healing',
  'Antioxidant',
  'Conditioning',
  'Sunscreen',
] as const

export const RM_UNITS = ['kg', 'gm', 'ltr', 'ml'] as const

export const RM_PHYSICAL_STATES = [
  'Liquid',
  'Powder',
  'Gel',
  'White',
  'Colourless',
  'Transparent',
] as const

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

export const rawMaterialCreateSchema = scopedSchema.extend({
  name: nameSchema,
  inciName: clearableTextSchema(500),
  code: codeSchema.optional().default(''),
  stock: stockSchema,
  unit: unitSchema,
  makeBrandName: clearableTextSchema(200),
  supplier: clearableTextSchema(200),
  benefit: clearableTextSchema(100),
  alternateRm: clearableTextSchema(200),
  physicalState: clearableTextSchema(100),
  isActive: z.boolean().optional(),
})

export const rawMaterialUpdateSchema = z
  .object({
    id: uuid(),
  })
  .merge(rawMaterialCreateSchema.partial())

export const rawMaterialDeleteSchema = z.object({
  id: uuid(),
})

export type RawMaterialCreateInput = z.infer<typeof rawMaterialCreateSchema>
export type RawMaterialUpdateInput = z.infer<typeof rawMaterialUpdateSchema>
export type RawMaterialDeleteInput = z.infer<typeof rawMaterialDeleteSchema>
