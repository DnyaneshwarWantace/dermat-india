import { randomUUID } from 'node:crypto'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { BatchStage, ProductionBatch } from '../data/entities'
import type { BatchStageType } from '../data/entities'
import {
  batchStageUpdateSchema,
  productionBatchCreateSchema,
  productionBatchUpdateSchema,
  signOffStageSchema,
  type BatchStageUpdateInput,
  type ProductionBatchCreateInput,
  type ProductionBatchUpdateInput,
  type SignOffStageInput,
} from '../data/validators'

const BATCH_NUMBER_PREFIX = 'BATCH'

const batchCrudIndexer: CrudIndexerConfig<ProductionBatch> = {
  entityType: (E as { dermat_production?: { production_batch?: string } }).dermat_production?.production_batch
    ?? 'dermat_production:production_batch',
}

const batchCrudEvents: CrudEventsConfig = {
  module: 'dermat_production',
  entity: 'batch',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

const stageCrudIndexer: CrudIndexerConfig<BatchStage> = {
  entityType: (E as { dermat_production?: { batch_stage?: string } }).dermat_production?.batch_stage
    ?? 'dermat_production:batch_stage',
}

const stageCrudEvents: CrudEventsConfig = {
  module: 'dermat_production',
  entity: 'batch_stage',
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

async function generateNextBatchNumber(em: EntityManager, organizationId: string, tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `${BATCH_NUMBER_PREFIX}-${year}-`
  const rows = await em.find(ProductionBatch, {
    organizationId,
    tenantId,
    batchNumber: { $like: `${prefix}%` },
  })

  let maxSeq = 0
  for (const row of rows) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(row.batchNumber)
    if (match) {
      const seq = Number.parseInt(match[1], 10)
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq
    }
  }

  const nextSeq = maxSeq + 1
  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}

const STAGE_SEQUENCE: Record<BatchStageType, number> = {
  bulk: 1,
  semi_finished: 2,
  finished: 3,
}

const createBatchCommand: CommandHandler<ProductionBatchCreateInput, { batchId: string }> = {
  id: 'dermat_production.batches.create',
  async execute(rawInput, ctx) {
    const parsed = productionBatchCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const batchNumber = await generateNextBatchNumber(em, parsed.organizationId, parsed.tenantId)

    // `id` is normally DB-generated (`defaultRaw: 'gen_random_uuid()'`), which
    // only resolves once `em.flush()` executes the INSERT. BatchStage rows are
    // created in the same flush and need the batch id as their FK, so it must
    // be generated client-side up front — mirrors sales/commands/documents.ts.
    const batchId = randomUUID()

    const batch = em.create(ProductionBatch, {
      id: batchId,
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      batchNumber,
      orderId: parsed.orderId ?? null,
      productName: parsed.productName,
      plannedQuantity: String(parsed.plannedQuantity),
      plannedUnit: parsed.plannedUnit,
      status: parsed.status ?? 'planned',
      createdBy: parsed.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(batch)

    const skipSemiFinished = parsed.skipSemiFinished === true
    const stages: BatchStage[] = (['bulk', 'semi_finished', 'finished'] as BatchStageType[]).map((stageType) =>
      em.create(BatchStage, {
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        productionBatchId: batchId,
        stageType,
        sequenceNumber: STAGE_SEQUENCE[stageType],
        isSkipped: stageType === 'semi_finished' ? skipSemiFinished : false,
        status: stageType === 'bulk' ? 'pending' : 'pending',
        wastageAction: 'pending_decision',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    )
    for (const stage of stages) em.persist(stage)

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: batch,
      identifiers: {
        id: batch.id,
        organizationId: batch.organizationId,
        tenantId: batch.tenantId,
      },
      indexer: batchCrudIndexer,
      events: batchCrudEvents,
    })

    return { batchId: batch.id }
  },
}

const updateBatchCommand: CommandHandler<ProductionBatchUpdateInput, { batchId: string }> = {
  id: 'dermat_production.batches.update',
  async execute(rawInput, ctx) {
    const parsed = productionBatchUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const batch = await em.findOne(ProductionBatch, { id: parsed.id })
    if (!batch) throw notFound('Production batch not found')
    ensureTenantScope(ctx, batch.tenantId)
    ensureOrganizationScope(ctx, batch.organizationId)

    if (parsed.orderId !== undefined) batch.orderId = parsed.orderId ?? null
    if (parsed.productName !== undefined) batch.productName = parsed.productName
    if (parsed.plannedQuantity !== undefined) batch.plannedQuantity = String(parsed.plannedQuantity)
    if (parsed.plannedUnit !== undefined) batch.plannedUnit = parsed.plannedUnit
    if (parsed.status !== undefined) batch.status = parsed.status
    if (parsed.createdBy !== undefined) batch.createdBy = parsed.createdBy ?? null

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: batch,
      identifiers: {
        id: batch.id,
        organizationId: batch.organizationId,
        tenantId: batch.tenantId,
      },
      indexer: batchCrudIndexer,
      events: batchCrudEvents,
    })

    return { batchId: batch.id }
  },
}

const deleteBatchCommand: CommandHandler<{ id: string }, { batchId: string }> = {
  id: 'dermat_production.batches.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] Production batch id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const batch = await em.findOne(ProductionBatch, { id })
    if (!batch) throw notFound('Production batch not found')
    ensureTenantScope(ctx, batch.tenantId)
    ensureOrganizationScope(ctx, batch.organizationId)

    await withAtomicFlush(em, [
      async () => {
        const now = new Date()
        batch.deletedAt = now
        const stages = await em.find(BatchStage, { productionBatchId: batch.id, deletedAt: null })
        for (const stage of stages) {
          stage.deletedAt = now
        }
      },
    ], { transaction: true, label: 'dermat_production.batches.delete' })

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: batch,
      identifiers: {
        id: batch.id,
        organizationId: batch.organizationId,
        tenantId: batch.tenantId,
      },
      indexer: batchCrudIndexer,
      events: batchCrudEvents,
    })

    return { batchId: batch.id }
  },
}

const updateBatchStageCommand: CommandHandler<BatchStageUpdateInput, { stageId: string }> = {
  id: 'dermat_production.batch_stages.update',
  async execute(rawInput, ctx) {
    const parsed = batchStageUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const stage = await em.findOne(BatchStage, { id: parsed.id })
    if (!stage) throw notFound('Batch stage not found')
    ensureTenantScope(ctx, stage.tenantId)
    ensureOrganizationScope(ctx, stage.organizationId)

    if (parsed.machineUsed !== undefined) stage.machineUsed = parsed.machineUsed ?? null
    if (parsed.operatorName !== undefined) stage.operatorName = parsed.operatorName ?? null
    if (parsed.shift !== undefined) stage.shift = parsed.shift ?? null
    if (parsed.plannedOutputQty !== undefined) {
      stage.plannedOutputQty = parsed.plannedOutputQty === null || parsed.plannedOutputQty === undefined
        ? null
        : String(parsed.plannedOutputQty)
    }
    if (parsed.actualOutputQty !== undefined) {
      stage.actualOutputQty = parsed.actualOutputQty === null || parsed.actualOutputQty === undefined
        ? null
        : String(parsed.actualOutputQty)
    }
    if (parsed.wastageQty !== undefined) {
      stage.wastageQty = parsed.wastageQty === null || parsed.wastageQty === undefined
        ? null
        : String(parsed.wastageQty)
    } else if (stage.plannedOutputQty != null && stage.actualOutputQty != null) {
      const planned = Number.parseFloat(stage.plannedOutputQty)
      const actual = Number.parseFloat(stage.actualOutputQty)
      if (Number.isFinite(planned) && Number.isFinite(actual)) {
        const diff = planned - actual
        stage.wastageQty = diff > 0 ? String(diff) : '0'
      }
    }
    if (parsed.wastageAction !== undefined) stage.wastageAction = parsed.wastageAction
    if (parsed.status !== undefined) {
      stage.status = parsed.status
      if (parsed.status === 'in_progress' && !stage.startedAt) stage.startedAt = new Date()
    }

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: stage,
      identifiers: {
        id: stage.id,
        organizationId: stage.organizationId,
        tenantId: stage.tenantId,
      },
      indexer: stageCrudIndexer,
      events: stageCrudEvents,
    })

    return { stageId: stage.id }
  },
}

const signOffStageCommand: CommandHandler<SignOffStageInput, { stageId: string }> = {
  id: 'dermat_production.batch_stages.sign_off',
  async execute(rawInput, ctx) {
    const parsed = signOffStageSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const stage = await em.findOne(BatchStage, { id: parsed.id })
    if (!stage) throw notFound('Batch stage not found')
    ensureTenantScope(ctx, stage.tenantId)
    ensureOrganizationScope(ctx, stage.organizationId)

    stage.status = 'done'
    stage.signedOffBy = parsed.signedOffBy
    stage.completedAt = new Date()
    if (parsed.actualOutputQty !== undefined) {
      stage.actualOutputQty = parsed.actualOutputQty === null ? null : String(parsed.actualOutputQty)
    }
    if (parsed.wastageQty !== undefined) {
      stage.wastageQty = parsed.wastageQty === null ? null : String(parsed.wastageQty)
    } else if (stage.plannedOutputQty != null && stage.actualOutputQty != null) {
      const planned = Number.parseFloat(stage.plannedOutputQty)
      const actual = Number.parseFloat(stage.actualOutputQty)
      if (Number.isFinite(planned) && Number.isFinite(actual)) {
        const diff = planned - actual
        stage.wastageQty = diff > 0 ? String(diff) : '0'
      }
    }
    if (parsed.wastageAction !== undefined) stage.wastageAction = parsed.wastageAction

    if (stage.stageType === 'bulk' || stage.stageType === 'semi_finished') {
      const nextStages = await em.find(BatchStage, {
        productionBatchId: stage.productionBatchId,
        sequenceNumber: { $gt: stage.sequenceNumber },
      }, { orderBy: { sequenceNumber: 'asc' } })
      const nextActive = nextStages.find((candidate) => !candidate.isSkipped)
      if (nextActive && nextActive.status === 'pending') {
        nextActive.status = 'pending'
      }
    }

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: stage,
      identifiers: {
        id: stage.id,
        organizationId: stage.organizationId,
        tenantId: stage.tenantId,
      },
      indexer: stageCrudIndexer,
      events: {
        module: 'dermat_production',
        entity: 'batch_stage',
        persistent: true,
        buildPayload: () => ({
          id: stage.id,
          organizationId: stage.organizationId,
          tenantId: stage.tenantId,
          stageType: stage.stageType,
          productionBatchId: stage.productionBatchId,
        }),
      },
    })

    return { stageId: stage.id }
  },
}

registerCommand(createBatchCommand)
registerCommand(updateBatchCommand)
registerCommand(deleteBatchCommand)
registerCommand(updateBatchStageCommand)
registerCommand(signOffStageCommand)
