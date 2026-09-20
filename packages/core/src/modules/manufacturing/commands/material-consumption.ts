import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError } from '@wantace/shared/lib/crud/errors'
import { MaterialConsumption } from '../data/entities'
import { createMaterialConsumptionSchema, updateMaterialConsumptionSchema, deleteMaterialConsumptionSchema } from '../data/validators'
import { ensureTenantScope, resolveEm } from './shared'

registerCommand({
  id: 'manufacturing.material_consumption.create',
  features: ['manufacturing.material_consumption.manage'],
  execute: async (payload, ctx) => {
    const parsed = createMaterialConsumptionSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const mc = em.create(MaterialConsumption, {
      ...parsed,
      productionOrder: parsed.productionOrderId as any,
      status: 'planned',
      actualQuantity: '0',
      wastageQuantity: '0',
    })
    await em.flush()
    return { materialConsumptionId: mc.id }
  },
})

registerCommand({
  id: 'manufacturing.material_consumption.update',
  features: ['manufacturing.material_consumption.manage'],
  execute: async (payload, ctx) => {
    const parsed = updateMaterialConsumptionSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const mc = await em.findOneOrFail(MaterialConsumption, { id: parsed.id, organizationId: parsed.organizationId, deletedAt: null })
    if (parsed.status) mc.status = parsed.status
    if (parsed.actualQuantity !== undefined) mc.actualQuantity = parsed.actualQuantity
    if (parsed.wastageQuantity !== undefined) mc.wastageQuantity = parsed.wastageQuantity
    if (parsed.notes !== undefined) mc.notes = parsed.notes
    if (parsed.status === 'issued' && !mc.issuedAt) {
      mc.issuedAt = new Date()
      mc.issuedBy = ctx.auth?.userId ?? null
    }
    await em.flush()
    return { ok: true }
  },
})

registerCommand({
  id: 'manufacturing.material_consumption.delete',
  features: ['manufacturing.material_consumption.manage'],
  execute: async (payload, ctx) => {
    const parsed = deleteMaterialConsumptionSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const mc = await em.findOneOrFail(MaterialConsumption, { id: parsed.id, organizationId: parsed.organizationId, deletedAt: null })
    if (mc.status === 'issued') throw new CrudHttpError(400, { error: 'Cannot delete issued material consumption.' })
    mc.deletedAt = new Date()
    await em.flush()
    return { ok: true }
  },
})
