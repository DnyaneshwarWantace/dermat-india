import type { CommandHandler } from '@wantace/shared/lib/commands'
import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError, isUniqueViolation } from '@wantace/shared/lib/crud/errors'
import { findOneWithDecryption } from '@wantace/shared/lib/encryption/find'
import { Machine, WorkCenter } from '../data/entities'
import {
  createMachineSchema,
  updateMachineSchema,
  type CreateMachineInput,
  type UpdateMachineInput,
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

async function loadMachine(em: import('@mikro-orm/postgresql').EntityManager, ctx: import('@wantace/shared/lib/commands').CommandRuntimeContext, id: string) {
  const machine = await findOneWithDecryption(em, Machine, { id, deletedAt: null }, undefined, resolveScope(ctx))
  if (!machine) throw new CrudHttpError(404, { error: 'Machine not found.' })
  ensureTenantScope(ctx, machine.tenantId)
  ensureOrganizationScope(ctx, machine.organizationId)
  return machine
}

function snapshotMachine(m: Machine) {
  return {
    id: m.id, name: m.name, code: m.code, description: m.description,
    status: m.status, makeModel: m.makeModel, serialNumber: m.serialNumber,
    notes: m.notes, organizationId: m.organizationId, tenantId: m.tenantId,
  }
}

const createMachineCommand: CommandHandler = {
  metadata: {
    id: 'manufacturing.machines.create',
    description: 'Create a machine',
    module: 'manufacturing',
    features: ['manufacturing.machines.manage'],
    context: { resourceKind: 'manufacturing.machine' },
  },
  async execute(input, ctx) {
    const parsed = createMachineSchema.parse(input) as CreateMachineInput
    const em = resolveEm(ctx)

    let workCenter: WorkCenter | null = null
    if (parsed.workCenterId) {
      workCenter = await findOneWithDecryption(em, WorkCenter, { id: parsed.workCenterId, deletedAt: null }, undefined, resolveScope(ctx))
      if (!workCenter) throw new CrudHttpError(400, { error: '[internal] Work center not found.' })
    }

    const machine = em.create(Machine, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      code: parsed.code,
      description: normalizeOptionalString(parsed.description),
      workCenter: workCenter ?? undefined,
      status: parsed.status ?? 'available',
      makeModel: normalizeOptionalString(parsed.makeModel),
      serialNumber: normalizeOptionalString(parsed.serialNumber),
      purchaseDate: parsed.purchaseDate ?? null,
      lastMaintenanceDate: parsed.lastMaintenanceDate ?? null,
      nextMaintenanceDate: parsed.nextMaintenanceDate ?? null,
      notes: normalizeOptionalString(parsed.notes),
    })
    try {
      await em.persistAndFlush(machine)
    } catch (err) {
      if (isUniqueViolation(err)) throw new CrudHttpError(409, { error: '[internal] Machine code already exists.' })
      throw err
    }
    await emitManufacturingEvent('manufacturing.machine.created', { id: machine.id, organizationId: machine.organizationId, tenantId: machine.tenantId }, ctx)
    return { machineId: machine.id }
  },
  async undo(input, ctx) {
    const em = resolveEm(ctx)
    const machine = await loadMachine(em, ctx, requireId(input?.machineId, 'Machine'))
    machine.deletedAt = new Date()
    await em.flush()
  },
}

const updateMachineCommand: CommandHandler = {
  metadata: {
    id: 'manufacturing.machines.update',
    description: 'Update a machine',
    module: 'manufacturing',
    features: ['manufacturing.machines.manage'],
    context: { resourceKind: 'manufacturing.machine' },
  },
  async prepare(input, ctx) {
    const parsed = updateMachineSchema.parse(input)
    const em = resolveEm(ctx)
    const machine = await loadMachine(em, ctx, parsed.id)
    return { before: snapshotMachine(machine) }
  },
  async execute(input, ctx) {
    const parsed = updateMachineSchema.parse(input) as UpdateMachineInput
    const em = resolveEm(ctx)
    const machine = await loadMachine(em, ctx, parsed.id)
    if (parsed.name !== undefined) machine.name = parsed.name
    if (parsed.code !== undefined) machine.code = parsed.code
    if (parsed.description !== undefined) machine.description = normalizeOptionalString(parsed.description)
    if (parsed.status !== undefined) machine.status = parsed.status
    if (parsed.makeModel !== undefined) machine.makeModel = normalizeOptionalString(parsed.makeModel)
    if (parsed.serialNumber !== undefined) machine.serialNumber = normalizeOptionalString(parsed.serialNumber)
    if (parsed.purchaseDate !== undefined) machine.purchaseDate = parsed.purchaseDate ?? null
    if (parsed.lastMaintenanceDate !== undefined) machine.lastMaintenanceDate = parsed.lastMaintenanceDate ?? null
    if (parsed.nextMaintenanceDate !== undefined) machine.nextMaintenanceDate = parsed.nextMaintenanceDate ?? null
    if (parsed.notes !== undefined) machine.notes = normalizeOptionalString(parsed.notes)
    if (parsed.workCenterId !== undefined) {
      if (parsed.workCenterId) {
        const wc = await findOneWithDecryption(em, WorkCenter, { id: parsed.workCenterId, deletedAt: null }, undefined, resolveScope(ctx))
        if (!wc) throw new CrudHttpError(400, { error: '[internal] Work center not found.' })
        machine.workCenter = wc
      } else {
        machine.workCenter = null
      }
    }
    try {
      await em.flush()
    } catch (err) {
      if (isUniqueViolation(err)) throw new CrudHttpError(409, { error: '[internal] Machine code already exists.' })
      throw err
    }
    await emitManufacturingEvent('manufacturing.machine.updated', { id: machine.id, organizationId: machine.organizationId, tenantId: machine.tenantId }, ctx)
    return { ok: true }
  },
}

const deleteMachineCommand: CommandHandler = {
  metadata: {
    id: 'manufacturing.machines.delete',
    description: 'Soft-delete a machine',
    module: 'manufacturing',
    features: ['manufacturing.machines.manage'],
    context: { resourceKind: 'manufacturing.machine' },
  },
  async prepare(input, ctx) {
    const id = requireId(input?.id, 'Machine')
    const em = resolveEm(ctx)
    const machine = await loadMachine(em, ctx, id)
    return { before: snapshotMachine(machine) }
  },
  async execute(input, ctx) {
    const id = requireId(input?.id, 'Machine')
    const em = resolveEm(ctx)
    const machine = await loadMachine(em, ctx, id)
    machine.deletedAt = new Date()
    await em.flush()
    await emitManufacturingEvent('manufacturing.machine.deleted', { id: machine.id, organizationId: machine.organizationId, tenantId: machine.tenantId }, ctx)
    return { ok: true }
  },
  async undo(input, ctx) {
    const before = input?.before
    if (!before?.id) return
    const em = resolveEm(ctx)
    const machine = await findOneWithDecryption(em, Machine, { id: before.id }, undefined, resolveScope(ctx))
    if (!machine) return
    machine.deletedAt = null
    await em.flush()
  },
}

registerCommand(createMachineCommand)
registerCommand(updateMachineCommand)
registerCommand(deleteMachineCommand)
