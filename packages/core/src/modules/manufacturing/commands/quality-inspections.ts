import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError } from '@wantace/shared/lib/crud/errors'
import { QualityInspection, QualityCheckItem } from '../data/entities'
import { createQualityInspectionSchema, updateQualityInspectionSchema, deleteQualityInspectionSchema } from '../data/validators'
import { ensureTenantScope, resolveEm } from './shared'
import { emitManufacturingEvent } from '../events'

async function generateInspectionNumber(em: ReturnType<typeof resolveEm>, organizationId: string): Promise<string> {
  const count = await em.count(QualityInspection, { organizationId })
  return `QI-${String(count + 1).padStart(5, '0')}`
}

registerCommand({
  id: 'manufacturing.quality_inspection.create',
  features: ['manufacturing.quality_inspections.manage'],
  execute: async (payload, ctx) => {
    const parsed = createQualityInspectionSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const inspectionNumber = await generateInspectionNumber(em, parsed.organizationId)
    const { checkItems, ...inspectionData } = parsed
    const inspection = em.create(QualityInspection, {
      ...inspectionData,
      inspectionNumber,
      status: 'pending',
      passedQuantity: '0',
      failedQuantity: '0',
    })
    await em.flush()
    if (checkItems?.length) {
      for (const item of checkItems) {
        em.create(QualityCheckItem, {
          ...item,
          inspection,
          organizationId: parsed.organizationId,
          tenantId: parsed.tenantId,
        })
      }
      await em.flush()
    }
    return { qualityInspectionId: inspection.id, inspectionNumber }
  },
})

registerCommand({
  id: 'manufacturing.quality_inspection.update',
  features: ['manufacturing.quality_inspections.manage'],
  execute: async (payload, ctx) => {
    const parsed = updateQualityInspectionSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const inspection = await em.findOneOrFail(QualityInspection, { id: parsed.id, organizationId: parsed.organizationId, deletedAt: null })
    const previousResult = inspection.overallResult

    if (parsed.status) inspection.status = parsed.status
    if (parsed.overallResult !== undefined) inspection.overallResult = parsed.overallResult
    if (parsed.inspectedQuantity !== undefined) inspection.inspectedQuantity = parsed.inspectedQuantity
    if (parsed.passedQuantity !== undefined) inspection.passedQuantity = parsed.passedQuantity
    if (parsed.failedQuantity !== undefined) inspection.failedQuantity = parsed.failedQuantity
    if (parsed.inspectorId !== undefined) inspection.inspectorId = parsed.inspectorId
    if (parsed.inspectedAt !== undefined) inspection.inspectedAt = parsed.inspectedAt
    if (parsed.notes !== undefined) inspection.notes = parsed.notes
    if (parsed.checkItems) {
      const existing = await em.find(QualityCheckItem, { inspection: { id: parsed.id }, deletedAt: null })
      for (const item of existing) { item.deletedAt = new Date() }
      for (const item of parsed.checkItems) {
        em.create(QualityCheckItem, {
          ...item,
          inspection,
          organizationId: parsed.organizationId,
          tenantId: parsed.tenantId,
        })
      }
    }
    await em.flush()

    if (parsed.overallResult && parsed.overallResult !== previousResult) {
      const eventPayload = {
        id: inspection.id,
        productionOrderId: inspection.productionOrderId,
        productName: inspection.productName,
        inspectionNumber: inspection.inspectionNumber,
        passedQuantity: Number(inspection.passedQuantity),
        failedQuantity: Number(inspection.failedQuantity),
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
      }

      if (parsed.overallResult === 'pass') {
        void emitManufacturingEvent('manufacturing.quality_inspection.passed', eventPayload)
      } else if (parsed.overallResult === 'fail') {
        void emitManufacturingEvent('manufacturing.quality_inspection.failed', eventPayload)
      }
    }

    return { ok: true }
  },
})

registerCommand({
  id: 'manufacturing.quality_inspection.delete',
  features: ['manufacturing.quality_inspections.manage'],
  execute: async (payload, ctx) => {
    const parsed = deleteQualityInspectionSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const inspection = await em.findOneOrFail(QualityInspection, { id: parsed.id, organizationId: parsed.organizationId, deletedAt: null })
    inspection.deletedAt = new Date()
    await em.flush()
    return { ok: true }
  },
})
