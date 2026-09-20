import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { Bom } from '../data/entities'
import {
  bomCreateSchema,
  bomUpdateSchema,
  type BomCreateInput,
  type BomUpdateInput,
} from '../data/validators'

const bomCrudIndexer: CrudIndexerConfig<Bom> = {
  entityType: (E as { dermat_bom?: { bom?: string } }).dermat_bom?.bom ?? 'dermat_bom:bom',
}

const bomCrudEvents: CrudEventsConfig = {
  module: 'dermat_bom',
  entity: 'bom',
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

const createBomCommand: CommandHandler<BomCreateInput, { bomId: string }> = {
  id: 'dermat_bom.boms.create',
  async execute(rawInput, ctx) {
    const parsed = bomCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const bom = em.create(Bom, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      bomName: parsed.bomName,
      catalogProductId: parsed.catalogProductId ?? null,
      batchQuantity: parsed.batchQuantity != null ? String(parsed.batchQuantity) : '1',
      version: parsed.version ?? 1,
      isActive: parsed.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(bom)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: bom,
      identifiers: {
        id: bom.id,
        organizationId: bom.organizationId,
        tenantId: bom.tenantId,
      },
      indexer: bomCrudIndexer,
      events: bomCrudEvents,
    })

    return { bomId: bom.id }
  },
}

const updateBomCommand: CommandHandler<BomUpdateInput, { bomId: string }> = {
  id: 'dermat_bom.boms.update',
  async execute(rawInput, ctx) {
    const parsed = bomUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const bom = await em.findOne(Bom, { id: parsed.id })
    if (!bom) throw notFound('BOM not found')
    ensureTenantScope(ctx, bom.tenantId)
    ensureOrganizationScope(ctx, bom.organizationId)

    if (parsed.bomName !== undefined) bom.bomName = parsed.bomName
    if (parsed.catalogProductId !== undefined) bom.catalogProductId = parsed.catalogProductId
    if (parsed.batchQuantity !== undefined) bom.batchQuantity = String(parsed.batchQuantity)
    if (parsed.version !== undefined) bom.version = parsed.version
    if (parsed.isActive !== undefined) bom.isActive = parsed.isActive

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: bom,
      identifiers: {
        id: bom.id,
        organizationId: bom.organizationId,
        tenantId: bom.tenantId,
      },
      indexer: bomCrudIndexer,
      events: bomCrudEvents,
    })

    return { bomId: bom.id }
  },
}

const deleteBomCommand: CommandHandler<{ id: string }, { bomId: string }> = {
  id: 'dermat_bom.boms.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] BOM id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const bom = await em.findOne(Bom, { id })
    if (!bom) throw notFound('BOM not found')
    ensureTenantScope(ctx, bom.tenantId)
    ensureOrganizationScope(ctx, bom.organizationId)

    bom.deletedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: bom,
      identifiers: {
        id: bom.id,
        organizationId: bom.organizationId,
        tenantId: bom.tenantId,
      },
      indexer: bomCrudIndexer,
      events: bomCrudEvents,
    })

    return { bomId: bom.id }
  },
}

registerCommand(createBomCommand)
registerCommand(updateBomCommand)
registerCommand(deleteBomCommand)
