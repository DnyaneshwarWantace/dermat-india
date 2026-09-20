import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { QcPolicy } from '../data/entities'
import {
  qcPolicyCreateSchema,
  qcPolicyUpdateSchema,
  type QcPolicyCreateInput,
  type QcPolicyUpdateInput,
} from '../data/validators'

const qcPolicyCrudIndexer: CrudIndexerConfig<QcPolicy> = {
  entityType: (E as { dermat_qc?: { qc_policy?: string } }).dermat_qc?.qc_policy ?? 'dermat_qc:qc_policy',
}

const qcPolicyCrudEvents: CrudEventsConfig = {
  module: 'dermat_qc',
  entity: 'qc_policy',
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

const createQcPolicyCommand: CommandHandler<QcPolicyCreateInput, { qcPolicyId: string }> = {
  id: 'dermat_qc.qc_policies.create',
  async execute(rawInput, ctx) {
    const parsed = qcPolicyCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const existing = await em.findOne(QcPolicy, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      appliesTo: parsed.appliesTo,
    })
    if (existing) {
      throw new CrudHttpError(409, { error: '[internal] QC policy already exists for this material/product' })
    }

    const qcPolicy = em.create(QcPolicy, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      appliesTo: parsed.appliesTo,
      chemicalRequired: parsed.chemicalRequired ?? true,
      microRequired: parsed.microRequired ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(qcPolicy)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: qcPolicy,
      identifiers: {
        id: qcPolicy.id,
        organizationId: qcPolicy.organizationId,
        tenantId: qcPolicy.tenantId,
      },
      indexer: qcPolicyCrudIndexer,
      events: qcPolicyCrudEvents,
    })

    return { qcPolicyId: qcPolicy.id }
  },
}

const updateQcPolicyCommand: CommandHandler<QcPolicyUpdateInput, { qcPolicyId: string }> = {
  id: 'dermat_qc.qc_policies.update',
  async execute(rawInput, ctx) {
    const parsed = qcPolicyUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const qcPolicy = await em.findOne(QcPolicy, { id: parsed.id })
    if (!qcPolicy) throw notFound('QC policy not found')
    ensureTenantScope(ctx, qcPolicy.tenantId)
    ensureOrganizationScope(ctx, qcPolicy.organizationId)

    if (parsed.appliesTo !== undefined && parsed.appliesTo !== qcPolicy.appliesTo) {
      const existing = await em.findOne(QcPolicy, {
        organizationId: qcPolicy.organizationId,
        tenantId: qcPolicy.tenantId,
        appliesTo: parsed.appliesTo,
      })
      if (existing && existing.id !== qcPolicy.id) {
        throw new CrudHttpError(409, { error: '[internal] QC policy already exists for this material/product' })
      }
      qcPolicy.appliesTo = parsed.appliesTo
    }
    if (parsed.chemicalRequired !== undefined) qcPolicy.chemicalRequired = parsed.chemicalRequired
    if (parsed.microRequired !== undefined) qcPolicy.microRequired = parsed.microRequired

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: qcPolicy,
      identifiers: {
        id: qcPolicy.id,
        organizationId: qcPolicy.organizationId,
        tenantId: qcPolicy.tenantId,
      },
      indexer: qcPolicyCrudIndexer,
      events: qcPolicyCrudEvents,
    })

    return { qcPolicyId: qcPolicy.id }
  },
}

const deleteQcPolicyCommand: CommandHandler<{ id: string }, { qcPolicyId: string }> = {
  id: 'dermat_qc.qc_policies.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] QC policy id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const qcPolicy = await em.findOne(QcPolicy, { id })
    if (!qcPolicy) throw notFound('QC policy not found')
    ensureTenantScope(ctx, qcPolicy.tenantId)
    ensureOrganizationScope(ctx, qcPolicy.organizationId)

    qcPolicy.deletedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: qcPolicy,
      identifiers: {
        id: qcPolicy.id,
        organizationId: qcPolicy.organizationId,
        tenantId: qcPolicy.tenantId,
      },
      indexer: qcPolicyCrudIndexer,
      events: qcPolicyCrudEvents,
    })

    return { qcPolicyId: qcPolicy.id }
  },
}

registerCommand(createQcPolicyCommand)
registerCommand(updateQcPolicyCommand)
registerCommand(deleteQcPolicyCommand)
