import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { RawMaterial } from '../data/entities'
import {
  rawMaterialCreateSchema,
  rawMaterialUpdateSchema,
  type RawMaterialCreateInput,
  type RawMaterialUpdateInput,
} from '../data/validators'

const RM_CODE_PREFIX = 'AP'

const rawMaterialCrudIndexer: CrudIndexerConfig<RawMaterial> = {
  entityType: (E as { dermat_rm_master?: { raw_material?: string } }).dermat_rm_master?.raw_material
    ?? 'dermat_rm_master:raw_material',
}

const rawMaterialCrudEvents: CrudEventsConfig = {
  module: 'dermat_rm_master',
  entity: 'raw_material',
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

async function generateNextRmCode(em: EntityManager, organizationId: string, tenantId: string): Promise<string> {
  const rows = await em.find(RawMaterial, {
    organizationId,
    tenantId,
    code: { $like: `${RM_CODE_PREFIX}-%` },
  })

  let maxSeq = 0
  for (const row of rows) {
    const match = /^AP-(\d+)$/.exec(row.code)
    if (match) {
      const seq = Number.parseInt(match[1], 10)
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq
    }
  }

  const nextSeq = maxSeq + 1
  return `${RM_CODE_PREFIX}-${String(nextSeq).padStart(3, '0')}`
}

const createRawMaterialCommand: CommandHandler<RawMaterialCreateInput, { rawMaterialId: string }> = {
  id: 'dermat_rm_master.rm_master.create',
  async execute(rawInput, ctx) {
    const parsed = rawMaterialCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const code = parsed.code?.trim().length
      ? parsed.code.trim()
      : await generateNextRmCode(em, parsed.organizationId, parsed.tenantId)

    const existing = await em.findOne(RawMaterial, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      code,
    })
    if (existing) {
      throw new CrudHttpError(409, { error: '[internal] Raw material code already in use' })
    }

    const rawMaterial = em.create(RawMaterial, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      inciName: parsed.inciName ?? null,
      code,
      stock: parsed.stock !== undefined ? String(parsed.stock) : '0',
      unit: parsed.unit,
      makeBrandName: parsed.makeBrandName ?? null,
      supplier: parsed.supplier ?? null,
      benefit: parsed.benefit ?? null,
      alternateRm: parsed.alternateRm ?? null,
      physicalState: parsed.physicalState ?? null,
      isActive: parsed.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(rawMaterial)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: rawMaterial,
      identifiers: {
        id: rawMaterial.id,
        organizationId: rawMaterial.organizationId,
        tenantId: rawMaterial.tenantId,
      },
      indexer: rawMaterialCrudIndexer,
      events: rawMaterialCrudEvents,
    })

    return { rawMaterialId: rawMaterial.id }
  },
}

const updateRawMaterialCommand: CommandHandler<RawMaterialUpdateInput, { rawMaterialId: string }> = {
  id: 'dermat_rm_master.rm_master.update',
  async execute(rawInput, ctx) {
    const parsed = rawMaterialUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const rawMaterial = await em.findOne(RawMaterial, { id: parsed.id })
    if (!rawMaterial) throw notFound('Raw material not found')
    ensureTenantScope(ctx, rawMaterial.tenantId)
    ensureOrganizationScope(ctx, rawMaterial.organizationId)

    if (parsed.code !== undefined && parsed.code.trim() !== rawMaterial.code) {
      const nextCode = parsed.code.trim()
      const existing = await em.findOne(RawMaterial, {
        organizationId: rawMaterial.organizationId,
        tenantId: rawMaterial.tenantId,
        code: nextCode,
      })
      if (existing && existing.id !== rawMaterial.id) {
        throw new CrudHttpError(409, { error: '[internal] Raw material code already in use' })
      }
      rawMaterial.code = nextCode
    }

    if (parsed.name !== undefined) rawMaterial.name = parsed.name
    if (parsed.inciName !== undefined) rawMaterial.inciName = parsed.inciName ?? null
    if (parsed.stock !== undefined) rawMaterial.stock = String(parsed.stock)
    if (parsed.unit !== undefined) rawMaterial.unit = parsed.unit
    if (parsed.makeBrandName !== undefined) rawMaterial.makeBrandName = parsed.makeBrandName ?? null
    if (parsed.supplier !== undefined) rawMaterial.supplier = parsed.supplier ?? null
    if (parsed.benefit !== undefined) rawMaterial.benefit = parsed.benefit ?? null
    if (parsed.alternateRm !== undefined) rawMaterial.alternateRm = parsed.alternateRm ?? null
    if (parsed.physicalState !== undefined) rawMaterial.physicalState = parsed.physicalState ?? null
    if (parsed.isActive !== undefined) rawMaterial.isActive = parsed.isActive

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: rawMaterial,
      identifiers: {
        id: rawMaterial.id,
        organizationId: rawMaterial.organizationId,
        tenantId: rawMaterial.tenantId,
      },
      indexer: rawMaterialCrudIndexer,
      events: rawMaterialCrudEvents,
    })

    return { rawMaterialId: rawMaterial.id }
  },
}

const deleteRawMaterialCommand: CommandHandler<{ id: string }, { rawMaterialId: string }> = {
  id: 'dermat_rm_master.rm_master.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] Raw material id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const rawMaterial = await em.findOne(RawMaterial, { id })
    if (!rawMaterial) throw notFound('Raw material not found')
    ensureTenantScope(ctx, rawMaterial.tenantId)
    ensureOrganizationScope(ctx, rawMaterial.organizationId)

    rawMaterial.deletedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: rawMaterial,
      identifiers: {
        id: rawMaterial.id,
        organizationId: rawMaterial.organizationId,
        tenantId: rawMaterial.tenantId,
      },
      indexer: rawMaterialCrudIndexer,
      events: rawMaterialCrudEvents,
    })

    return { rawMaterialId: rawMaterial.id }
  },
}

registerCommand(createRawMaterialCommand)
registerCommand(updateRawMaterialCommand)
registerCommand(deleteRawMaterialCommand)
