import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError } from '@wantace/shared/lib/crud/errors'
import { ProductionStageTemplate } from '../data/entities'
import { createStageTemplateSchema, updateStageTemplateSchema, deleteStageTemplateSchema } from '../data/validators'
import { ensureTenantScope, resolveEm } from './shared'

registerCommand({
  id: 'manufacturing.stage_template.create',
  features: ['manufacturing.stage_templates.manage'],
  execute: async (payload, ctx) => {
    const parsed = createStageTemplateSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const template = em.create(ProductionStageTemplate, {
      ...parsed,
    })
    await em.flush()
    return { id: template.id }
  },
})

registerCommand({
  id: 'manufacturing.stage_template.update',
  features: ['manufacturing.stage_templates.manage'],
  execute: async (payload, ctx) => {
    const parsed = updateStageTemplateSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const template = await em.findOneOrFail(ProductionStageTemplate, {
      id: parsed.id,
      organizationId: parsed.organizationId,
      deletedAt: null,
    })

    if (parsed.name !== undefined) template.name = parsed.name
    if (parsed.code !== undefined) template.code = parsed.code
    if (parsed.description !== undefined) template.description = parsed.description
    if (parsed.sequenceNumber !== undefined) template.sequenceNumber = parsed.sequenceNumber
    if (parsed.isActive !== undefined) template.isActive = parsed.isActive
    if (parsed.defaultWorkCenterId !== undefined) template.defaultWorkCenterId = parsed.defaultWorkCenterId
    if (parsed.defaultMachineId !== undefined) template.defaultMachineId = parsed.defaultMachineId
    if (parsed.estimatedSetupMinutes !== undefined) template.estimatedSetupMinutes = parsed.estimatedSetupMinutes
    if (parsed.estimatedRunMinutes !== undefined) template.estimatedRunMinutes = parsed.estimatedRunMinutes
    if (parsed.requiresQualityCheck !== undefined) template.requiresQualityCheck = parsed.requiresQualityCheck
    if (parsed.notes !== undefined) template.notes = parsed.notes

    await em.flush()
    return { ok: true }
  },
})

registerCommand({
  id: 'manufacturing.stage_template.delete',
  features: ['manufacturing.stage_templates.manage'],
  execute: async (payload, ctx) => {
    const parsed = deleteStageTemplateSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const template = await em.findOneOrFail(ProductionStageTemplate, {
      id: parsed.id,
      organizationId: parsed.organizationId,
      deletedAt: null,
    })
    template.deletedAt = new Date()
    await em.flush()
    return { ok: true }
  },
})
