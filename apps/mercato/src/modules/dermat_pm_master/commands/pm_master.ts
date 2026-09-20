import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { PackagingMaterial } from '../data/entities'
import {
  packagingMaterialCreateSchema,
  packagingMaterialUpdateSchema,
  type PackagingMaterialCreateInput,
  type PackagingMaterialUpdateInput,
} from '../data/validators'

const PM_CODE_PREFIX = 'PM'

const packagingMaterialCrudIndexer: CrudIndexerConfig<PackagingMaterial> = {
  entityType: (E as { dermat_pm_master?: { packaging_material?: string } }).dermat_pm_master?.packaging_material
    ?? 'dermat_pm_master:packaging_material',
}

const packagingMaterialCrudEvents: CrudEventsConfig = {
  module: 'dermat_pm_master',
  entity: 'packaging_material',
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

async function generateNextPmCode(em: EntityManager, organizationId: string, tenantId: string): Promise<string> {
  const rows = await em.find(PackagingMaterial, {
    organizationId,
    tenantId,
    code: { $like: `${PM_CODE_PREFIX}-%` },
  })

  let maxSeq = 0
  for (const row of rows) {
    const match = /^PM-(\d+)$/.exec(row.code)
    if (match) {
      const seq = Number.parseInt(match[1], 10)
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq
    }
  }

  const nextSeq = maxSeq + 1
  return `${PM_CODE_PREFIX}-${String(nextSeq).padStart(3, '0')}`
}

const createPackagingMaterialCommand: CommandHandler<PackagingMaterialCreateInput, { packagingMaterialId: string }> = {
  id: 'dermat_pm_master.pm_master.create',
  async execute(rawInput, ctx) {
    const parsed = packagingMaterialCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const code = parsed.code?.trim().length
      ? parsed.code.trim()
      : await generateNextPmCode(em, parsed.organizationId, parsed.tenantId)

    const existing = await em.findOne(PackagingMaterial, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      code,
    })
    if (existing) {
      throw new CrudHttpError(409, { error: '[internal] Packaging material code already in use' })
    }

    const packagingMaterial = em.create(PackagingMaterial, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      code,
      stock: parsed.stock !== undefined ? String(parsed.stock) : '0',
      unit: parsed.unit,
      makeBrandName: parsed.makeBrandName ?? null,
      supplier: parsed.supplier ?? null,
      category: parsed.category ?? null,
      dimensions: parsed.dimensions ?? null,
      isActive: parsed.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(packagingMaterial)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: packagingMaterial,
      identifiers: {
        id: packagingMaterial.id,
        organizationId: packagingMaterial.organizationId,
        tenantId: packagingMaterial.tenantId,
      },
      indexer: packagingMaterialCrudIndexer,
      events: packagingMaterialCrudEvents,
    })

    return { packagingMaterialId: packagingMaterial.id }
  },
}

const updatePackagingMaterialCommand: CommandHandler<PackagingMaterialUpdateInput, { packagingMaterialId: string }> = {
  id: 'dermat_pm_master.pm_master.update',
  async execute(rawInput, ctx) {
    const parsed = packagingMaterialUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const packagingMaterial = await em.findOne(PackagingMaterial, { id: parsed.id })
    if (!packagingMaterial) throw notFound('Packaging material not found')
    ensureTenantScope(ctx, packagingMaterial.tenantId)
    ensureOrganizationScope(ctx, packagingMaterial.organizationId)

    if (parsed.code !== undefined && parsed.code.trim() !== packagingMaterial.code) {
      const nextCode = parsed.code.trim()
      const existing = await em.findOne(PackagingMaterial, {
        organizationId: packagingMaterial.organizationId,
        tenantId: packagingMaterial.tenantId,
        code: nextCode,
      })
      if (existing && existing.id !== packagingMaterial.id) {
        throw new CrudHttpError(409, { error: '[internal] Packaging material code already in use' })
      }
      packagingMaterial.code = nextCode
    }

    if (parsed.name !== undefined) packagingMaterial.name = parsed.name
    if (parsed.stock !== undefined) packagingMaterial.stock = String(parsed.stock)
    if (parsed.unit !== undefined) packagingMaterial.unit = parsed.unit
    if (parsed.makeBrandName !== undefined) packagingMaterial.makeBrandName = parsed.makeBrandName ?? null
    if (parsed.supplier !== undefined) packagingMaterial.supplier = parsed.supplier ?? null
    if (parsed.category !== undefined) packagingMaterial.category = parsed.category ?? null
    if (parsed.dimensions !== undefined) packagingMaterial.dimensions = parsed.dimensions ?? null
    if (parsed.isActive !== undefined) packagingMaterial.isActive = parsed.isActive

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: packagingMaterial,
      identifiers: {
        id: packagingMaterial.id,
        organizationId: packagingMaterial.organizationId,
        tenantId: packagingMaterial.tenantId,
      },
      indexer: packagingMaterialCrudIndexer,
      events: packagingMaterialCrudEvents,
    })

    return { packagingMaterialId: packagingMaterial.id }
  },
}

const deletePackagingMaterialCommand: CommandHandler<{ id: string }, { packagingMaterialId: string }> = {
  id: 'dermat_pm_master.pm_master.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] Packaging material id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const packagingMaterial = await em.findOne(PackagingMaterial, { id })
    if (!packagingMaterial) throw notFound('Packaging material not found')
    ensureTenantScope(ctx, packagingMaterial.tenantId)
    ensureOrganizationScope(ctx, packagingMaterial.organizationId)

    packagingMaterial.deletedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: packagingMaterial,
      identifiers: {
        id: packagingMaterial.id,
        organizationId: packagingMaterial.organizationId,
        tenantId: packagingMaterial.tenantId,
      },
      indexer: packagingMaterialCrudIndexer,
      events: packagingMaterialCrudEvents,
    })

    return { packagingMaterialId: packagingMaterial.id }
  },
}

registerCommand(createPackagingMaterialCommand)
registerCommand(updatePackagingMaterialCommand)
registerCommand(deletePackagingMaterialCommand)
