import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { Bom, BomLine } from '../data/entities'
import {
  bomLineCreateSchema,
  bomLineUpdateSchema,
  type BomLineCreateInput,
  type BomLineUpdateInput,
} from '../data/validators'

const bomLineCrudIndexer: CrudIndexerConfig<BomLine> = {
  entityType: (E as { dermat_bom?: { bom_line?: string } }).dermat_bom?.bom_line ?? 'dermat_bom:bom_line',
}

const bomLineCrudEvents: CrudEventsConfig = {
  module: 'dermat_bom',
  entity: 'bom_line',
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

function computeQuantities(qtyPerUnit: number, batchQuantity: number, wastagePercent: number) {
  const quantity = qtyPerUnit * batchQuantity
  const totalQty = quantity * (1 + wastagePercent / 100)
  return { quantity, totalQty }
}

async function loadBatchQuantity(em: EntityManager, bomId: string): Promise<number> {
  const bom = await em.findOne(Bom, { id: bomId })
  if (!bom) throw notFound('BOM not found')
  return Number(bom.batchQuantity) || 1
}

const createBomLineCommand: CommandHandler<BomLineCreateInput, { bomLineId: string }> = {
  id: 'dermat_bom.bom_lines.create',
  async execute(rawInput, ctx) {
    const parsed = bomLineCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()

    let sequenceNumber = parsed.sequenceNumber
    if (sequenceNumber === undefined) {
      const maxRow = await em.findOne(
        BomLine,
        { bomId: parsed.bomId, deletedAt: null },
        { orderBy: { sequenceNumber: 'desc' } },
      )
      sequenceNumber = (maxRow?.sequenceNumber ?? -1) + 1
    }

    const batchQuantity = await loadBatchQuantity(em, parsed.bomId)
    const wastagePercent = Number(parsed.wastagePercent ?? 0)
    const { quantity, totalQty } = computeQuantities(Number(parsed.qtyPerUnit), batchQuantity, wastagePercent)

    const line = em.create(BomLine, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      bomId: parsed.bomId,
      componentKind: parsed.componentKind,
      rawMaterialId: parsed.rawMaterialId ?? null,
      packagingMaterialId: parsed.packagingMaterialId ?? null,
      componentCode: parsed.componentCode ?? null,
      qtyPerUnit: String(parsed.qtyPerUnit),
      quantity: String(quantity),
      wastagePercent: String(wastagePercent),
      totalQty: String(totalQty),
      unit: parsed.unit ?? 'kg',
      rmPercent: parsed.rmPercent !== undefined && parsed.rmPercent !== null ? String(parsed.rmPercent) : null,
      sequenceNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(line)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: line,
      identifiers: {
        id: line.id,
        organizationId: line.organizationId,
        tenantId: line.tenantId,
      },
      indexer: bomLineCrudIndexer,
      events: bomLineCrudEvents,
    })

    return { bomLineId: line.id }
  },
}

const updateBomLineCommand: CommandHandler<BomLineUpdateInput, { bomLineId: string }> = {
  id: 'dermat_bom.bom_lines.update',
  async execute(rawInput, ctx) {
    const parsed = bomLineUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const line = await em.findOne(BomLine, { id: parsed.id })
    if (!line) throw notFound('BOM line not found')
    ensureTenantScope(ctx, line.tenantId)
    ensureOrganizationScope(ctx, line.organizationId)

    if (parsed.componentKind !== undefined) line.componentKind = parsed.componentKind
    if (parsed.rawMaterialId !== undefined) line.rawMaterialId = parsed.rawMaterialId ?? null
    if (parsed.packagingMaterialId !== undefined) line.packagingMaterialId = parsed.packagingMaterialId ?? null
    if (parsed.componentCode !== undefined) line.componentCode = parsed.componentCode ?? null
    if (parsed.unit !== undefined) line.unit = parsed.unit
    if (parsed.rmPercent !== undefined) line.rmPercent = parsed.rmPercent !== null ? String(parsed.rmPercent) : null
    if (parsed.sequenceNumber !== undefined) line.sequenceNumber = parsed.sequenceNumber

    const qtyChanged = parsed.qtyPerUnit !== undefined || parsed.wastagePercent !== undefined
    if (parsed.qtyPerUnit !== undefined) line.qtyPerUnit = String(parsed.qtyPerUnit)
    if (parsed.wastagePercent !== undefined) line.wastagePercent = String(parsed.wastagePercent)

    if (qtyChanged) {
      const batchQuantity = await loadBatchQuantity(em, line.bomId)
      const { quantity, totalQty } = computeQuantities(
        Number(line.qtyPerUnit),
        batchQuantity,
        Number(line.wastagePercent),
      )
      line.quantity = String(quantity)
      line.totalQty = String(totalQty)
    }

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: line,
      identifiers: {
        id: line.id,
        organizationId: line.organizationId,
        tenantId: line.tenantId,
      },
      indexer: bomLineCrudIndexer,
      events: bomLineCrudEvents,
    })

    return { bomLineId: line.id }
  },
}

const deleteBomLineCommand: CommandHandler<{ id: string }, { bomLineId: string }> = {
  id: 'dermat_bom.bom_lines.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] BOM line id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const line = await em.findOne(BomLine, { id })
    if (!line) throw notFound('BOM line not found')
    ensureTenantScope(ctx, line.tenantId)
    ensureOrganizationScope(ctx, line.organizationId)

    line.deletedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: line,
      identifiers: {
        id: line.id,
        organizationId: line.organizationId,
        tenantId: line.tenantId,
      },
      indexer: bomLineCrudIndexer,
      events: bomLineCrudEvents,
    })

    return { bomLineId: line.id }
  },
}

registerCommand(createBomLineCommand)
registerCommand(updateBomLineCommand)
registerCommand(deleteBomLineCommand)
