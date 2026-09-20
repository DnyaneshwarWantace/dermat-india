import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { Sample } from '../data/entities'
import {
  sampleCreateSchema,
  sampleStatusUpdateSchema,
  type SampleCreateInput,
  type SampleStatusUpdateInput,
} from '../data/validators'
import { emitDermatSamplingEvent } from '../events'

const sampleCrudIndexer: CrudIndexerConfig<Sample> = {
  entityType: (E as { dermat_sampling?: { sample?: string } }).dermat_sampling?.sample ?? 'dermat_sampling:sample',
}

const sampleCrudEvents: CrudEventsConfig = {
  module: 'dermat_sampling',
  entity: 'sample',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

function ensureTenantScope(ctx: { auth?: { tenantId?: string | null } | null }, tenantId: string): void {
  if (ctx.auth?.tenantId && ctx.auth.tenantId !== tenantId) {
    throw new CrudHttpError(403, { error: '[internal] tenant scope mismatch' })
  }
}

function ensureOrganizationScope(
  ctx: { selectedOrganizationId?: string | null; auth?: { orgId?: string | null } | null },
  organizationId: string | undefined,
): void {
  const scopedOrgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (organizationId && scopedOrgId && organizationId !== scopedOrgId) {
    throw new CrudHttpError(403, { error: '[internal] organization scope mismatch' })
  }
}

const createSampleCommand: CommandHandler<SampleCreateInput, { sampleId: string }> = {
  id: 'dermat_sampling.samples.create',
  async execute(rawInput, ctx) {
    const parsed = sampleCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const sample = em.create(Sample, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      orderId: parsed.orderId,
      productName: parsed.productName ?? null,
      status: 'requested',
      rndStage: parsed.rndStage ?? 'pending',
      sourceOrderVerifiedBy: parsed.sourceOrderVerifiedBy ?? null,
      requestedBy: parsed.requestedBy ?? null,
      requestedAt: new Date(),
      notes: parsed.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(sample)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: sample,
      identifiers: {
        id: sample.id,
        organizationId: sample.organizationId,
        tenantId: sample.tenantId,
      },
      indexer: sampleCrudIndexer,
      events: sampleCrudEvents,
    })

    return { sampleId: sample.id }
  },
}

const updateSampleStatusCommand: CommandHandler<SampleStatusUpdateInput, { sampleId: string }> = {
  id: 'dermat_sampling.samples.update_status',
  async execute(rawInput, ctx) {
    const parsed = sampleStatusUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const sample = await em.findOne(Sample, { id: parsed.id })
    if (!sample) throw notFound('Sample not found')
    ensureTenantScope(ctx, sample.tenantId)
    ensureOrganizationScope(ctx, sample.organizationId)

    if (parsed.status === 'rejected' && !parsed.rejectionReason) {
      throw new CrudHttpError(400, { error: '[internal] rejectionReason is required when rejecting a sample' })
    }

    if (parsed.status !== undefined) {
      sample.status = parsed.status
      if (parsed.status === 'sent') {
        sample.sentAt = new Date()
      }
      if (parsed.status === 'approved' || parsed.status === 'rejected') {
        sample.customerDecisionAt = new Date()
        sample.rejectionReason = parsed.status === 'rejected' ? (parsed.rejectionReason ?? null) : null
      }
    }
    if (parsed.rndStage !== undefined) {
      sample.rndStage = parsed.rndStage
    }
    sample.notes = parsed.notes !== undefined ? parsed.notes ?? null : sample.notes

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: sample,
      identifiers: {
        id: sample.id,
        organizationId: sample.organizationId,
        tenantId: sample.tenantId,
      },
      indexer: sampleCrudIndexer,
      events: sampleCrudEvents,
    })

    if (parsed.status === 'approved') {
      await emitDermatSamplingEvent('dermat_sampling.sample.approved', {
        sampleId: sample.id,
        orderId: sample.orderId,
        organizationId: sample.organizationId,
        tenantId: sample.tenantId,
      })
    } else if (parsed.status === 'rejected') {
      await emitDermatSamplingEvent('dermat_sampling.sample.rejected', {
        sampleId: sample.id,
        orderId: sample.orderId,
        organizationId: sample.organizationId,
        tenantId: sample.tenantId,
      })
    }

    return { sampleId: sample.id }
  },
}

const deleteSampleCommand: CommandHandler<{ id: string }, { sampleId: string }> = {
  id: 'dermat_sampling.samples.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] Sample id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const sample = await em.findOne(Sample, { id })
    if (!sample) throw notFound('Sample not found')
    ensureTenantScope(ctx, sample.tenantId)
    ensureOrganizationScope(ctx, sample.organizationId)

    sample.deletedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: sample,
      identifiers: {
        id: sample.id,
        organizationId: sample.organizationId,
        tenantId: sample.tenantId,
      },
      indexer: sampleCrudIndexer,
      events: sampleCrudEvents,
    })

    return { sampleId: sample.id }
  },
}

registerCommand(createSampleCommand)
registerCommand(updateSampleStatusCommand)
registerCommand(deleteSampleCommand)
