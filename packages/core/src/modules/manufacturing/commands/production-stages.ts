import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError } from '@wantace/shared/lib/crud/errors'
import { wrap } from '@mikro-orm/core'
import { ProductionStage } from '../data/entities'
import { createProductionStageSchema, updateProductionStageSchema, deleteProductionStageSchema } from '../data/validators'
import { ensureTenantScope, resolveEm } from './shared'
import { emitManufacturingEvent } from '../events'

registerCommand({
  id: 'manufacturing.production_stage.create',
  features: ['manufacturing.production_stages.manage'],
  execute: async (payload, ctx) => {
    const parsed = createProductionStageSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const stage = em.create(ProductionStage, {
      ...parsed,
      productionOrder: parsed.productionOrderId as any,
      status: 'pending',
      producedQuantity: '0',
      rejectedQuantity: '0',
      actualSetupMinutes: '0',
      actualRunMinutes: '0',
    })
    await em.flush()
    return { productionStageId: stage.id }
  },
})

registerCommand({
  id: 'manufacturing.production_stage.update',
  features: ['manufacturing.production_stages.manage'],
  execute: async (payload, ctx) => {
    const parsed = updateProductionStageSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const stage = await em.findOneOrFail(ProductionStage, { id: parsed.id, organizationId: parsed.organizationId, deletedAt: null })
    const previousStatus = stage.status

    if (parsed.status) stage.status = parsed.status
    if (parsed.producedQuantity !== undefined) stage.producedQuantity = parsed.producedQuantity
    if (parsed.rejectedQuantity !== undefined) stage.rejectedQuantity = parsed.rejectedQuantity
    if (parsed.actualSetupMinutes !== undefined) stage.actualSetupMinutes = parsed.actualSetupMinutes
    if (parsed.actualRunMinutes !== undefined) stage.actualRunMinutes = parsed.actualRunMinutes
    if (parsed.operatorId !== undefined) stage.operatorId = parsed.operatorId
    if (parsed.notes !== undefined) stage.notes = parsed.notes
    if (parsed.status === 'in_progress' && !stage.startedAt) stage.startedAt = new Date()
    if (parsed.status === 'completed' && !stage.completedAt) stage.completedAt = new Date()
    await em.flush()

    if (parsed.status === 'completed' && previousStatus !== 'completed') {
      const serialized = wrap(stage).toObject()
      void emitManufacturingEvent('manufacturing.production_stage.completed', {
        id: stage.id,
        productionOrderId: (serialized as Record<string, unknown>).production_order_id as string,
        sequenceNumber: stage.sequenceNumber,
        name: stage.name,
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
      })
    }

    return { ok: true }
  },
})

registerCommand({
  id: 'manufacturing.production_stage.delete',
  features: ['manufacturing.production_stages.manage'],
  execute: async (payload, ctx) => {
    const parsed = deleteProductionStageSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const stage = await em.findOneOrFail(ProductionStage, { id: parsed.id, organizationId: parsed.organizationId, deletedAt: null })
    if (stage.status === 'in_progress') throw new CrudHttpError(400, { error: 'Cannot delete an in-progress stage.' })
    stage.deletedAt = new Date()
    await em.flush()
    return { ok: true }
  },
})
