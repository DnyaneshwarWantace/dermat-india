import { z } from 'zod'

const uuid = () => z.string().uuid()

export const SAMPLE_STATUSES = ['requested', 'in_preparation', 'sent', 'approved', 'rejected'] as const

export const sampleStatusSchema = z.enum(SAMPLE_STATUSES)

export const SAMPLE_RND_STAGES = ['pending', 'in_progress', 'completed'] as const

export const sampleRndStageSchema = z.enum(SAMPLE_RND_STAGES)

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

export const sampleCreateSchema = scopedSchema.extend({
  orderId: z.string().trim().min(1).max(200),
  productName: clearableTextSchema(300),
  requestedBy: clearableTextSchema(200),
  notes: clearableTextSchema(2000),
  rndStage: sampleRndStageSchema.optional(),
  sourceOrderVerifiedBy: clearableTextSchema(200),
})

export const sampleStatusUpdateSchema = z.object({
  id: uuid(),
  status: sampleStatusSchema.optional(),
  rndStage: sampleRndStageSchema.optional(),
  rejectionReason: clearableTextSchema(2000),
  notes: clearableTextSchema(2000),
}).refine((v) => v.status !== undefined || v.rndStage !== undefined, {
  message: '[internal] status or rndStage is required',
})

export const sampleDeleteSchema = z.object({ id: uuid() })

export type SampleCreateInput = z.infer<typeof sampleCreateSchema>
export type SampleStatusUpdateInput = z.infer<typeof sampleStatusUpdateSchema>
