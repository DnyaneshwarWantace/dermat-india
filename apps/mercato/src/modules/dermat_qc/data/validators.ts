import { z } from 'zod'

const uuid = () => z.string().uuid()

export const QC_REFERENCE_TYPES = ['batch_stage', 'grn'] as const
export const QC_TEST_TYPES = ['chemical', 'micro'] as const
export const QC_RESULTS = ['pending', 'pass', 'fail'] as const

export const qcReferenceTypeSchema = z.enum(QC_REFERENCE_TYPES)
export const qcTestTypeSchema = z.enum(QC_TEST_TYPES)
export const qcResultSchema = z.enum(QC_RESULTS)

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

export const qcTestCreateSchema = scopedSchema.extend({
  referenceType: qcReferenceTypeSchema,
  referenceId: clearableTextSchema(200),
  testType: qcTestTypeSchema,
  result: qcResultSchema.optional(),
  testedBy: clearableTextSchema(200),
  remarks: clearableTextSchema(2000),
})

export const qcTestUpdateSchema = z
  .object({ id: uuid() })
  .merge(qcTestCreateSchema.partial())

export const qcTestResultUpdateSchema = z.object({
  id: uuid(),
  result: qcResultSchema,
  testedBy: clearableTextSchema(200),
  remarks: clearableTextSchema(2000),
})

export const qcTestDeleteSchema = z.object({ id: uuid() })

const appliesToSchema = z.string().trim().min(1).max(200)

export const qcPolicyCreateSchema = scopedSchema.extend({
  appliesTo: appliesToSchema,
  chemicalRequired: z.boolean().optional(),
  microRequired: z.boolean().optional(),
})

export const qcPolicyUpdateSchema = z
  .object({ id: uuid() })
  .merge(qcPolicyCreateSchema.partial())

export const qcPolicyDeleteSchema = z.object({ id: uuid() })

export type QcTestCreateInput = z.infer<typeof qcTestCreateSchema>
export type QcTestUpdateInput = z.infer<typeof qcTestUpdateSchema>
export type QcTestResultUpdateInput = z.infer<typeof qcTestResultUpdateSchema>
export type QcPolicyCreateInput = z.infer<typeof qcPolicyCreateSchema>
export type QcPolicyUpdateInput = z.infer<typeof qcPolicyUpdateSchema>
