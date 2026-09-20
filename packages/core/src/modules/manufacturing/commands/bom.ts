import type { CommandHandler } from '@wantace/shared/lib/commands'
import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError, isUniqueViolation } from '@wantace/shared/lib/crud/errors'
import { findOneWithDecryption } from '@wantace/shared/lib/encryption/find'
import { BillOfMaterials, BOMLine, BOMOperation } from '../data/entities'
import {
  createBOMSchema,
  updateBOMSchema,
  type CreateBOMInput,
  type UpdateBOMInput,
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

async function loadBOM(em: import('@mikro-orm/postgresql').EntityManager, ctx: import('@wantace/shared/lib/commands').CommandRuntimeContext, id: string) {
  const bom = await findOneWithDecryption(em, BillOfMaterials, { id, deletedAt: null }, { populate: ['lines', 'operations'] }, resolveScope(ctx))
  if (!bom) throw new CrudHttpError(404, { error: 'Bill of materials not found.' })
  ensureTenantScope(ctx, bom.tenantId)
  ensureOrganizationScope(ctx, bom.organizationId)
  return bom
}

function computeBOMCosts(lines: Array<{ unitCostCents: number; quantity: string; wastagePercent?: string }>) {
  let materialCost = 0
  for (const line of lines) {
    const qty = parseFloat(line.quantity) || 0
    const wastage = parseFloat(line.wastagePercent ?? '0') || 0
    const effectiveQty = qty * (1 + wastage / 100)
    materialCost += Math.round(line.unitCostCents * effectiveQty)
  }
  return materialCost
}

function computeOperationCosts(operations: Array<{ costCents: number }>) {
  return operations.reduce((sum, op) => sum + op.costCents, 0)
}

function snapshotBOM(bom: BillOfMaterials) {
  return {
    id: bom.id, name: bom.name, code: bom.code, status: bom.status,
    productVariantId: bom.productVariantId, productName: bom.productName,
    outputQuantity: bom.outputQuantity, isDefault: bom.isDefault,
    materialCostCents: bom.materialCostCents, operationCostCents: bom.operationCostCents,
    totalCostCents: bom.totalCostCents, notes: bom.notes,
    organizationId: bom.organizationId, tenantId: bom.tenantId,
  }
}

const createBOMCommand: CommandHandler = {
  metadata: {
    id: 'manufacturing.bom.create',
    description: 'Create a bill of materials',
    module: 'manufacturing',
    features: ['manufacturing.bom.manage'],
    context: { resourceKind: 'manufacturing.bom' },
  },
  async execute(input, ctx) {
    const parsed = createBOMSchema.parse(input) as CreateBOMInput
    const em = resolveEm(ctx)

    const materialCost = computeBOMCosts(parsed.lines)
    const operationCost = computeOperationCosts(parsed.operations ?? [])

    const bom = em.create(BillOfMaterials, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      code: parsed.code,
      description: normalizeOptionalString(parsed.description),
      productVariantId: parsed.productVariantId,
      productName: parsed.productName,
      outputQuantity: parsed.outputQuantity,
      unitOfMeasure: normalizeOptionalString(parsed.unitOfMeasure),
      status: 'draft',
      isDefault: parsed.isDefault ?? false,
      materialCostCents: materialCost,
      operationCostCents: operationCost,
      totalCostCents: materialCost + operationCost,
      notes: normalizeOptionalString(parsed.notes),
    })
    try {
      await em.persistAndFlush(bom)
    } catch (err) {
      if (isUniqueViolation(err)) throw new CrudHttpError(409, { error: '[internal] BOM code already exists.' })
      throw err
    }

    for (const line of parsed.lines) {
      const qty = parseFloat(line.quantity) || 0
      const wastage = parseFloat(line.wastagePercent ?? '0') || 0
      const effectiveQty = qty * (1 + wastage / 100)
      const lineTotal = Math.round(line.unitCostCents * effectiveQty)
      em.create(BOMLine, {
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        bom,
        lineNumber: line.lineNumber,
        productVariantId: line.productVariantId,
        productName: line.productName,
        productSku: normalizeOptionalString(line.productSku),
        quantity: line.quantity,
        unitOfMeasure: normalizeOptionalString(line.unitOfMeasure),
        rmPercent: line.rmPercent ?? null,
        wastagePercent: line.wastagePercent ?? '0',
        unitCostCents: line.unitCostCents,
        lineTotal,
        isCritical: line.isCritical ?? false,
        subBomId: line.subBomId ?? null,
        notes: normalizeOptionalString(line.notes),
      })
    }

    if (parsed.operations) {
      for (const op of parsed.operations) {
        em.create(BOMOperation, {
          organizationId: parsed.organizationId,
          tenantId: parsed.tenantId,
          bom,
          sequenceNumber: op.sequenceNumber,
          name: op.name,
          description: normalizeOptionalString(op.description),
          workCenterId: op.workCenterId ?? null,
          machineId: op.machineId ?? null,
          setupTimeMinutes: op.setupTimeMinutes ?? '0',
          runTimeMinutes: op.runTimeMinutes ?? '0',
          costCents: op.costCents ?? 0,
          notes: normalizeOptionalString(op.notes),
        })
      }
    }
    await em.flush()

    await emitManufacturingEvent('manufacturing.bom.created', { id: bom.id, organizationId: bom.organizationId, tenantId: bom.tenantId }, ctx)
    return { bomId: bom.id }
  },
  async undo(input, ctx) {
    const em = resolveEm(ctx)
    const bom = await loadBOM(em, ctx, requireId(input?.bomId, 'BOM'))
    bom.deletedAt = new Date()
    await em.flush()
  },
}

const updateBOMCommand: CommandHandler = {
  metadata: {
    id: 'manufacturing.bom.update',
    description: 'Update a bill of materials',
    module: 'manufacturing',
    features: ['manufacturing.bom.manage'],
    context: { resourceKind: 'manufacturing.bom' },
  },
  async prepare(input, ctx) {
    const parsed = updateBOMSchema.parse(input)
    const em = resolveEm(ctx)
    const bom = await loadBOM(em, ctx, parsed.id)
    return { before: snapshotBOM(bom) }
  },
  async execute(input, ctx) {
    const parsed = updateBOMSchema.parse(input) as UpdateBOMInput
    const em = resolveEm(ctx)
    const bom = await loadBOM(em, ctx, parsed.id)

    if (parsed.name !== undefined) bom.name = parsed.name
    if (parsed.code !== undefined) bom.code = parsed.code
    if (parsed.description !== undefined) bom.description = normalizeOptionalString(parsed.description)
    if (parsed.productVariantId !== undefined) bom.productVariantId = parsed.productVariantId
    if (parsed.productName !== undefined) bom.productName = parsed.productName
    if (parsed.outputQuantity !== undefined) bom.outputQuantity = parsed.outputQuantity
    if (parsed.unitOfMeasure !== undefined) bom.unitOfMeasure = normalizeOptionalString(parsed.unitOfMeasure)
    if (parsed.status !== undefined) bom.status = parsed.status
    if (parsed.isDefault !== undefined) bom.isDefault = parsed.isDefault
    if (parsed.notes !== undefined) bom.notes = normalizeOptionalString(parsed.notes)

    if (parsed.lines) {
      for (const existing of bom.lines.getItems()) em.remove(existing)
      const materialCost = computeBOMCosts(parsed.lines)
      bom.materialCostCents = materialCost
      for (const line of parsed.lines) {
        const qty = parseFloat(line.quantity) || 0
        const wastage = parseFloat(line.wastagePercent ?? '0') || 0
        const effectiveQty = qty * (1 + wastage / 100)
        const lineTotal = Math.round(line.unitCostCents * effectiveQty)
        em.create(BOMLine, {
          organizationId: bom.organizationId,
          tenantId: bom.tenantId,
          bom,
          lineNumber: line.lineNumber,
          productVariantId: line.productVariantId,
          productName: line.productName,
          productSku: normalizeOptionalString(line.productSku),
          quantity: line.quantity,
          unitOfMeasure: normalizeOptionalString(line.unitOfMeasure),
          rmPercent: line.rmPercent ?? null,
          wastagePercent: line.wastagePercent ?? '0',
          unitCostCents: line.unitCostCents,
          lineTotal,
          isCritical: line.isCritical ?? false,
          subBomId: line.subBomId ?? null,
          notes: normalizeOptionalString(line.notes),
        })
      }
    }

    if (parsed.operations) {
      for (const existing of bom.operations.getItems()) em.remove(existing)
      const operationCost = computeOperationCosts(parsed.operations)
      bom.operationCostCents = operationCost
      for (const op of parsed.operations) {
        em.create(BOMOperation, {
          organizationId: bom.organizationId,
          tenantId: bom.tenantId,
          bom,
          sequenceNumber: op.sequenceNumber,
          name: op.name,
          description: normalizeOptionalString(op.description),
          workCenterId: op.workCenterId ?? null,
          machineId: op.machineId ?? null,
          setupTimeMinutes: op.setupTimeMinutes ?? '0',
          runTimeMinutes: op.runTimeMinutes ?? '0',
          costCents: op.costCents ?? 0,
          notes: normalizeOptionalString(op.notes),
        })
      }
    }

    bom.totalCostCents = bom.materialCostCents + bom.operationCostCents

    try {
      await em.flush()
    } catch (err) {
      if (isUniqueViolation(err)) throw new CrudHttpError(409, { error: '[internal] BOM code already exists.' })
      throw err
    }
    await emitManufacturingEvent('manufacturing.bom.updated', { id: bom.id, organizationId: bom.organizationId, tenantId: bom.tenantId }, ctx)
    return { ok: true }
  },
}

const deleteBOMCommand: CommandHandler = {
  metadata: {
    id: 'manufacturing.bom.delete',
    description: 'Soft-delete a bill of materials',
    module: 'manufacturing',
    features: ['manufacturing.bom.manage'],
    context: { resourceKind: 'manufacturing.bom' },
  },
  async prepare(input, ctx) {
    const id = requireId(input?.id, 'BOM')
    const em = resolveEm(ctx)
    const bom = await loadBOM(em, ctx, id)
    return { before: snapshotBOM(bom) }
  },
  async execute(input, ctx) {
    const id = requireId(input?.id, 'BOM')
    const em = resolveEm(ctx)
    const bom = await loadBOM(em, ctx, id)
    bom.deletedAt = new Date()
    await em.flush()
    await emitManufacturingEvent('manufacturing.bom.deleted', { id: bom.id, organizationId: bom.organizationId, tenantId: bom.tenantId }, ctx)
    return { ok: true }
  },
  async undo(input, ctx) {
    const before = input?.before
    if (!before?.id) return
    const em = resolveEm(ctx)
    const bom = await findOneWithDecryption(em, BillOfMaterials, { id: before.id }, undefined, resolveScope(ctx))
    if (!bom) return
    bom.deletedAt = null
    await em.flush()
  },
}

registerCommand(createBOMCommand)
registerCommand(updateBOMCommand)
registerCommand(deleteBOMCommand)
