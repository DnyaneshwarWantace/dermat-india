import { z } from 'zod'

const uuid = () => z.string().uuid()

export const PRODUCTION_BATCH_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'] as const
export const BATCH_STAGE_TYPES = ['bulk', 'semi_finished', 'finished'] as const
export const BATCH_STAGE_STATUSES = ['pending', 'in_progress', 'done', 'qc_pending', 'qc_passed', 'qc_failed'] as const
export const WASTAGE_ACTIONS = ['wasted', 'returned_to_stock', 'pending_decision'] as const

export const productionBatchStatusSchema = z.enum(PRODUCTION_BATCH_STATUSES)
export const batchStageTypeSchema = z.enum(BATCH_STAGE_TYPES)
export const batchStageStatusSchema = z.enum(BATCH_STAGE_STATUSES)
export const wastageActionSchema = z.enum(WASTAGE_ACTIONS)

const emptyStringToNull = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const clearableTextSchema = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().max(max).nullable().optional())

const clearableNumberSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return null
  return value
}, z.coerce.number().min(0).nullable().optional())

const scopedSchema = z.object({
  organizationId: uuid(),
  tenantId: uuid(),
})

const productNameSchema = z.string().trim().min(1).max(200)
const unitSchema = z.string().trim().min(1).max(20)
const quantitySchema = z.coerce.number().min(0)

export const productionBatchCreateSchema = scopedSchema.extend({
  orderId: clearableTextSchema(200),
  productName: productNameSchema,
  plannedQuantity: quantitySchema,
  plannedUnit: unitSchema,
  status: productionBatchStatusSchema.optional(),
  createdBy: clearableTextSchema(200),
  skipSemiFinished: z.boolean().optional(),
})

export const productionBatchUpdateSchema = z
  .object({ id: uuid() })
  .merge(productionBatchCreateSchema.omit({ skipSemiFinished: true }).partial())

export const productionBatchDeleteSchema = z.object({ id: uuid() })

export const batchStageUpdateSchema = z.object({
  id: uuid(),
  machineUsed: clearableTextSchema(200),
  operatorName: clearableTextSchema(200),
  shift: clearableTextSchema(50),
  plannedOutputQty: clearableNumberSchema,
  actualOutputQty: clearableNumberSchema,
  wastageQty: clearableNumberSchema,
  wastageAction: wastageActionSchema.optional(),
  status: batchStageStatusSchema.optional(),
})

export const signOffStageSchema = z.object({
  id: uuid(),
  signedOffBy: z.string().trim().min(1).max(200),
  actualOutputQty: clearableNumberSchema,
  wastageQty: clearableNumberSchema,
  wastageAction: wastageActionSchema.optional(),
})

export type ProductionBatchCreateInput = z.infer<typeof productionBatchCreateSchema>
export type ProductionBatchUpdateInput = z.infer<typeof productionBatchUpdateSchema>
export type BatchStageUpdateInput = z.infer<typeof batchStageUpdateSchema>
export type SignOffStageInput = z.infer<typeof signOffStageSchema>
