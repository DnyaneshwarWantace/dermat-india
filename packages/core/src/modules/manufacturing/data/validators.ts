import { z } from 'zod'

const uuid = () => z.string().uuid()

const emptyStringToNull = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const clearableStringSchema = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().max(max).nullable().optional())

const scopedSchema = z.object({
  organizationId: uuid(),
  tenantId: uuid(),
})

// ── Work Center ──────────────────────────────────────────────────────────────

export const createWorkCenterSchema = scopedSchema.extend({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  description: clearableStringSchema(2000),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active'),
  costPerHourCents: z.coerce.number().int().min(0).default(0),
  capacityPerDay: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid capacity').nullable().optional(),
  unitOfMeasure: clearableStringSchema(50),
  location: clearableStringSchema(200),
  notes: clearableStringSchema(5000),
})

export type CreateWorkCenterInput = z.infer<typeof createWorkCenterSchema>

export const updateWorkCenterSchema = createWorkCenterSchema.partial().extend({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
})

export type UpdateWorkCenterInput = z.infer<typeof updateWorkCenterSchema>

export const deleteWorkCenterSchema = scopedSchema.extend({ id: uuid() })

// ── Machine ──────────────────────────────────────────────────────────────────

export const createMachineSchema = scopedSchema.extend({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  description: clearableStringSchema(2000),
  workCenterId: uuid().nullable().optional(),
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']).default('available'),
  makeModel: clearableStringSchema(200),
  serialNumber: clearableStringSchema(100),
  purchaseDate: z.coerce.date().nullable().optional(),
  lastMaintenanceDate: z.coerce.date().nullable().optional(),
  nextMaintenanceDate: z.coerce.date().nullable().optional(),
  notes: clearableStringSchema(5000),
})

export type CreateMachineInput = z.infer<typeof createMachineSchema>

export const updateMachineSchema = createMachineSchema.partial().extend({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
})

export type UpdateMachineInput = z.infer<typeof updateMachineSchema>

export const deleteMachineSchema = scopedSchema.extend({ id: uuid() })

// ── Bill of Materials ────────────────────────────────────────────────────────

export const bomLineSchema = z.object({
  lineNumber: z.coerce.number().int().min(1),
  productVariantId: uuid(),
  productName: z.string().trim().min(1).max(300),
  productSku: clearableStringSchema(100),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity'),
  unitOfMeasure: clearableStringSchema(50),
  rmPercent: z.string().regex(/^\d+(\.\d{1,3})?$/, 'Invalid RM %').nullable().optional(),
  wastagePercent: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  unitCostCents: z.coerce.number().int().min(0).default(0),
  isCritical: z.boolean().default(false),
  subBomId: uuid().nullable().optional(),
  notes: clearableStringSchema(2000),
})

export type BOMLineInput = z.infer<typeof bomLineSchema>

export const bomOperationSchema = z.object({
  sequenceNumber: z.coerce.number().int().min(1),
  name: z.string().trim().min(1).max(200),
  description: clearableStringSchema(2000),
  workCenterId: uuid().nullable().optional(),
  machineId: uuid().nullable().optional(),
  setupTimeMinutes: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  runTimeMinutes: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  costCents: z.coerce.number().int().min(0).default(0),
  notes: clearableStringSchema(2000),
})

export type BOMOperationInput = z.infer<typeof bomOperationSchema>

export const createBOMSchema = scopedSchema.extend({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  description: clearableStringSchema(2000),
  productVariantId: uuid(),
  productName: z.string().trim().min(1).max(300),
  outputQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity'),
  unitOfMeasure: clearableStringSchema(50),
  isDefault: z.boolean().default(false),
  notes: clearableStringSchema(5000),
  lines: z.array(bomLineSchema).min(1),
  operations: z.array(bomOperationSchema).optional(),
})

export type CreateBOMInput = z.infer<typeof createBOMSchema>

export const updateBOMSchema = z.object({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().min(1).max(50).optional(),
  description: clearableStringSchema(2000),
  productVariantId: uuid().optional(),
  productName: z.string().trim().min(1).max(300).optional(),
  outputQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity').optional(),
  unitOfMeasure: clearableStringSchema(50),
  status: z.enum(['draft', 'active', 'obsolete']).optional(),
  isDefault: z.boolean().optional(),
  notes: clearableStringSchema(5000),
  lines: z.array(bomLineSchema).optional(),
  operations: z.array(bomOperationSchema).optional(),
})

export type UpdateBOMInput = z.infer<typeof updateBOMSchema>

export const deleteBOMSchema = scopedSchema.extend({ id: uuid() })

// ── Production Order ────────────────────────────────────────────────────────

export const createProductionOrderSchema = scopedSchema.extend({
  salesOrderId: uuid().nullable().optional(),
  salesOrderNumber: clearableStringSchema(100),
  bomId: uuid(),
  bomName: z.string().trim().min(1).max(300),
  productVariantId: uuid(),
  productName: z.string().trim().min(1).max(300),
  plannedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid quantity'),
  unitOfMeasure: clearableStringSchema(50),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  plannedStartDate: z.coerce.date().nullable().optional(),
  plannedEndDate: z.coerce.date().nullable().optional(),
  warehouseId: uuid().nullable().optional(),
  notes: clearableStringSchema(5000),
})

export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>

export const updateProductionOrderSchema = z.object({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
  status: z.enum(['draft', 'planned', 'in_progress', 'completed', 'cancelled', 'on_hold']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  plannedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  producedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  rejectedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  plannedStartDate: z.coerce.date().nullable().optional(),
  plannedEndDate: z.coerce.date().nullable().optional(),
  actualStartDate: z.coerce.date().nullable().optional(),
  actualEndDate: z.coerce.date().nullable().optional(),
  warehouseId: uuid().nullable().optional(),
  notes: clearableStringSchema(5000),
})

export type UpdateProductionOrderInput = z.infer<typeof updateProductionOrderSchema>

export const deleteProductionOrderSchema = scopedSchema.extend({ id: uuid() })

// ── Production Stage ────────────────────────────────────────────────────────

export const createProductionStageSchema = scopedSchema.extend({
  productionOrderId: uuid(),
  sequenceNumber: z.coerce.number().int().min(1),
  name: z.string().trim().min(1).max(200),
  description: clearableStringSchema(2000),
  workCenterId: uuid().nullable().optional(),
  machineId: uuid().nullable().optional(),
  plannedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  plannedSetupMinutes: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  plannedRunMinutes: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  notes: clearableStringSchema(5000),
})

export type CreateProductionStageInput = z.infer<typeof createProductionStageSchema>

export const updateProductionStageSchema = z.object({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
  producedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  rejectedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  actualSetupMinutes: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  actualRunMinutes: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  operatorId: uuid().nullable().optional(),
  notes: clearableStringSchema(5000),
})

export type UpdateProductionStageInput = z.infer<typeof updateProductionStageSchema>

export const deleteProductionStageSchema = scopedSchema.extend({ id: uuid() })

// ── Material Consumption ────────────────────────────────────────────────────

export const createMaterialConsumptionSchema = scopedSchema.extend({
  productionOrderId: uuid(),
  bomLineId: uuid().nullable().optional(),
  productVariantId: uuid(),
  productName: z.string().trim().min(1).max(300),
  productSku: clearableStringSchema(100),
  plannedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitOfMeasure: clearableStringSchema(50),
  unitCostCents: z.coerce.number().int().min(0).default(0),
  warehouseId: uuid().nullable().optional(),
  lotId: uuid().nullable().optional(),
  notes: clearableStringSchema(5000),
})

export type CreateMaterialConsumptionInput = z.infer<typeof createMaterialConsumptionSchema>

export const updateMaterialConsumptionSchema = z.object({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
  status: z.enum(['planned', 'issued', 'returned', 'scrapped']).optional(),
  actualQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  wastageQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  notes: clearableStringSchema(5000),
})

export type UpdateMaterialConsumptionInput = z.infer<typeof updateMaterialConsumptionSchema>

export const deleteMaterialConsumptionSchema = scopedSchema.extend({ id: uuid() })

// ── Quality Inspection ──────────────────────────────────────────────────────

export const qualityCheckItemSchema = z.object({
  checkName: z.string().trim().min(1).max(200),
  description: clearableStringSchema(2000),
  specification: clearableStringSchema(500),
  minValue: z.string().regex(/^-?\d+(\.\d{1,4})?$/).nullable().optional(),
  maxValue: z.string().regex(/^-?\d+(\.\d{1,4})?$/).nullable().optional(),
  measuredValue: z.string().regex(/^-?\d+(\.\d{1,4})?$/).nullable().optional(),
  textValue: clearableStringSchema(500),
  result: z.enum(['pass', 'fail', 'conditional']).nullable().optional(),
  notes: clearableStringSchema(2000),
})

export type QualityCheckItemInput = z.infer<typeof qualityCheckItemSchema>

export const createQualityInspectionSchema = scopedSchema.extend({
  inspectionType: z.enum(['incoming', 'in_process', 'final', 'periodic']),
  productionOrderId: uuid().nullable().optional(),
  productionStageId: uuid().nullable().optional(),
  productVariantId: uuid(),
  productName: z.string().trim().min(1).max(300),
  inspectedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).default('0'),
  notes: clearableStringSchema(5000),
  checkItems: z.array(qualityCheckItemSchema).optional(),
})

export type CreateQualityInspectionInput = z.infer<typeof createQualityInspectionSchema>

export const updateQualityInspectionSchema = z.object({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
  status: z.enum(['pending', 'in_progress', 'passed', 'failed', 'on_hold']).optional(),
  overallResult: z.enum(['pass', 'fail', 'conditional']).nullable().optional(),
  inspectedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  passedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  failedQuantity: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  inspectorId: uuid().nullable().optional(),
  inspectedAt: z.coerce.date().nullable().optional(),
  notes: clearableStringSchema(5000),
  checkItems: z.array(qualityCheckItemSchema).optional(),
})

export type UpdateQualityInspectionInput = z.infer<typeof updateQualityInspectionSchema>

export const deleteQualityInspectionSchema = scopedSchema.extend({ id: uuid() })

// ── Production Stage Template ──────────────────────────────────────────────

export const createStageTemplateSchema = scopedSchema.extend({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  description: clearableStringSchema(2000),
  sequenceNumber: z.coerce.number().int().min(1),
  isActive: z.boolean().default(true),
  defaultWorkCenterId: uuid().nullable().optional(),
  defaultMachineId: uuid().nullable().optional(),
  estimatedSetupMinutes: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  estimatedRunMinutes: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  requiresQualityCheck: z.boolean().default(false),
  notes: clearableStringSchema(5000),
})

export type CreateStageTemplateInput = z.infer<typeof createStageTemplateSchema>

export const updateStageTemplateSchema = createStageTemplateSchema.partial().extend({
  id: uuid(),
  organizationId: uuid(),
  tenantId: uuid(),
})

export type UpdateStageTemplateInput = z.infer<typeof updateStageTemplateSchema>

export const deleteStageTemplateSchema = scopedSchema.extend({ id: uuid() })
