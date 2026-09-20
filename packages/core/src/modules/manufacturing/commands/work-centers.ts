import type { CommandHandler } from '@wantace/shared/lib/commands'
import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError, isUniqueViolation } from '@wantace/shared/lib/crud/errors'
import { findOneWithDecryption } from '@wantace/shared/lib/encryption/find'
import { WorkCenter } from '../data/entities'
import {
  createWorkCenterSchema,
  updateWorkCenterSchema,
  type CreateWorkCenterInput,
  type UpdateWorkCenterInput,
} from '../data/validators'
import { emitManufacturingEvent } from '../events'
import {
  ensureTenantScope,
  ensureOrganizationScope,
  normalizeOptionalString,
  requireId,
  resolveScope,
  resolveEm,
} from './shared'

async function loadWorkCenter(em: import('@mikro-orm/postgresql').EntityManager, ctx: import('@wantace/shared/lib/commands').CommandRuntimeContext, id: string) {
  const wc = await findOneWithDecryption(em, WorkCenter, { id, deletedAt: null }, undefined, resolveScope(ctx))
  if (!wc) throw new CrudHttpError(404, { error: 'Work center not found.' })
  ensureTenantScope(ctx, wc.tenantId)
  ensureOrganizationScope(ctx, wc.organizationId)
  return wc
}

function snapshotWorkCenter(wc: WorkCenter) {
  return {
    id: wc.id, name: wc.name, code: wc.code, description: wc.description,
    status: wc.status, costPerHourCents: wc.costPerHourCents, capacityPerDay: wc.capacityPerDay,
    unitOfMeasure: wc.unitOfMeasure, location: wc.location, notes: wc.notes,
    organizationId: wc.organizationId, tenantId: wc.tenantId,
  }
}

const createWorkCenterCommand: CommandHandler = {
  metadata: {
    id: 'manufacturing.work_centers.create',
    description: 'Create a work center',
    module: 'manufacturing',
    features: ['manufacturing.work_centers.manage'],
    context: { resourceKind: 'manufacturing.work_center' },
  },
  async execute(input, ctx) {
    const parsed = createWorkCenterSchema.parse(input) as CreateWorkCenterInput
    const em = resolveEm(ctx)
    const wc = em.create(WorkCenter, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      code: parsed.code,
      description: normalizeOptionalString(parsed.description),
      status: parsed.status ?? 'active',
      costPerHourCents: parsed.costPerHourCents ?? 0,
      capacityPerDay: parsed.capacityPerDay ?? null,
      unitOfMeasure: normalizeOptionalString(parsed.unitOfMeasure),
      location: normalizeOptionalString(parsed.location),
      notes: normalizeOptionalString(parsed.notes),
    })
    try {
      await em.persistAndFlush(wc)
    } catch (err) {
      if (isUniqueViolation(err)) throw new CrudHttpError(409, { error: '[internal] Work center code already exists.' })
      throw err
    }
    await emitManufacturingEvent('manufacturing.work_center.created', { id: wc.id, organizationId: wc.organizationId, tenantId: wc.tenantId }, ctx)
    return { workCenterId: wc.id }
  },
  async undo(input, ctx) {
    const em = resolveEm(ctx)
    const wc = await loadWorkCenter(em, ctx, requireId(input?.workCenterId, 'WorkCenter'))
    wc.deletedAt = new Date()
    await em.flush()
  },
}

const updateWorkCenterCommand: CommandHandler = {
  metadata: {
    id: 'manufacturing.work_centers.update',
    description: 'Update a work center',
    module: 'manufacturing',
    features: ['manufacturing.work_centers.manage'],
    context: { resourceKind: 'manufacturing.work_center' },
  },
  async prepare(input, ctx) {
    const parsed = updateWorkCenterSchema.parse(input)
    const em = resolveEm(ctx)
    const wc = await loadWorkCenter(em, ctx, parsed.id)
    return { before: snapshotWorkCenter(wc) }
  },
  async execute(input, ctx) {
    const parsed = updateWorkCenterSchema.parse(input) as UpdateWorkCenterInput
    const em = resolveEm(ctx)
    const wc = await loadWorkCenter(em, ctx, parsed.id)
    if (parsed.name !== undefined) wc.name = parsed.name
    if (parsed.code !== undefined) wc.code = parsed.code
    if (parsed.description !== undefined) wc.description = normalizeOptionalString(parsed.description)
    if (parsed.status !== undefined) wc.status = parsed.status
    if (parsed.costPerHourCents !== undefined) wc.costPerHourCents = parsed.costPerHourCents
    if (parsed.capacityPerDay !== undefined) wc.capacityPerDay = parsed.capacityPerDay ?? null
    if (parsed.unitOfMeasure !== undefined) wc.unitOfMeasure = normalizeOptionalString(parsed.unitOfMeasure)
    if (parsed.location !== undefined) wc.location = normalizeOptionalString(parsed.location)
    if (parsed.notes !== undefined) wc.notes = normalizeOptionalString(parsed.notes)
    try {
      await em.flush()
    } catch (err) {
      if (isUniqueViolation(err)) throw new CrudHttpError(409, { error: '[internal] Work center code already exists.' })
      throw err
    }
    await emitManufacturingEvent('manufacturing.work_center.updated', { id: wc.id, organizationId: wc.organizationId, tenantId: wc.tenantId }, ctx)
    return { ok: true }
  },
}

const deleteWorkCenterCommand: CommandHandler = {
  metadata: {
    id: 'manufacturing.work_centers.delete',
    description: 'Soft-delete a work center',
    module: 'manufacturing',
    features: ['manufacturing.work_centers.manage'],
    context: { resourceKind: 'manufacturing.work_center' },
  },
  async prepare(input, ctx) {
    const id = requireId(input?.id, 'WorkCenter')
    const em = resolveEm(ctx)
    const wc = await loadWorkCenter(em, ctx, id)
    return { before: snapshotWorkCenter(wc) }
  },
  async execute(input, ctx) {
    const id = requireId(input?.id, 'WorkCenter')
    const em = resolveEm(ctx)
    const wc = await loadWorkCenter(em, ctx, id)
    wc.deletedAt = new Date()
    await em.flush()
    await emitManufacturingEvent('manufacturing.work_center.deleted', { id: wc.id, organizationId: wc.organizationId, tenantId: wc.tenantId }, ctx)
    return { ok: true }
  },
  async undo(input, ctx) {
    const before = input?.before
    if (!before?.id) return
    const em = resolveEm(ctx)
    const wc = await findOneWithDecryption(em, WorkCenter, { id: before.id }, undefined, resolveScope(ctx))
    if (!wc) return
    wc.deletedAt = null
    await em.flush()
  },
}

registerCommand(createWorkCenterCommand)
registerCommand(updateWorkCenterCommand)
registerCommand(deleteWorkCenterCommand)
