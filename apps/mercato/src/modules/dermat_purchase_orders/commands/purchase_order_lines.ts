import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { PurchaseOrderLine } from '../data/entities'
import {
  purchaseOrderLineCreateSchema,
  purchaseOrderLineUpdateSchema,
  type PurchaseOrderLineCreateInput,
  type PurchaseOrderLineUpdateInput,
} from '../data/validators'

const poLineCrudIndexer: CrudIndexerConfig<PurchaseOrderLine> = {
  entityType: (E as { dermat_purchase_orders?: { purchase_order_line?: string } }).dermat_purchase_orders?.purchase_order_line
    ?? 'dermat_purchase_orders:purchase_order_line',
}

const poLineCrudEvents: CrudEventsConfig = {
  module: 'dermat_purchase_orders',
  entity: 'purchase_order_line',
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

const createPurchaseOrderLineCommand: CommandHandler<PurchaseOrderLineCreateInput, { purchaseOrderLineId: string }> = {
  id: 'dermat_purchase_orders.purchase_order_lines.create',
  async execute(rawInput, ctx) {
    const parsed = purchaseOrderLineCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()

    let sequenceNumber = parsed.sequenceNumber
    if (sequenceNumber === undefined) {
      const maxRow = await em.findOne(
        PurchaseOrderLine,
        { purchaseOrderId: parsed.purchaseOrderId, deletedAt: null },
        { orderBy: { sequenceNumber: 'desc' } },
      )
      sequenceNumber = (maxRow?.sequenceNumber ?? -1) + 1
    }

    const line = em.create(PurchaseOrderLine, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      purchaseOrderId: parsed.purchaseOrderId,
      lineKind: parsed.lineKind,
      rawMaterialId: parsed.rawMaterialId ?? null,
      packagingMaterialId: parsed.packagingMaterialId ?? null,
      componentCode: parsed.componentCode ?? null,
      quantity: String(parsed.quantity),
      pack: parsed.pack != null ? String(parsed.pack) : null,
      freeQuantity: String(parsed.freeQuantity ?? 0),
      mrp: parsed.mrp != null ? String(parsed.mrp) : null,
      unit: parsed.unit ?? 'kg',
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
      indexer: poLineCrudIndexer,
      events: poLineCrudEvents,
    })

    return { purchaseOrderLineId: line.id }
  },
}

// Receiving + QC approval both flow through this same update command. Master stock
// only increments the instant a line transitions into qcApproved=true — never on
// receivedQuantity alone — matching the client's explicit requirement that raw
// material cannot move in/out of usable stock without a QC sign-off.
const updatePurchaseOrderLineCommand: CommandHandler<PurchaseOrderLineUpdateInput, { purchaseOrderLineId: string }> = {
  id: 'dermat_purchase_orders.purchase_order_lines.update',
  async execute(rawInput, ctx) {
    const parsed = purchaseOrderLineUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const line = await em.findOne(PurchaseOrderLine, { id: parsed.id })
    if (!line) throw notFound('Purchase order line not found')
    ensureTenantScope(ctx, line.tenantId)
    ensureOrganizationScope(ctx, line.organizationId)

    if (parsed.rawMaterialId !== undefined) line.rawMaterialId = parsed.rawMaterialId ?? null
    if (parsed.packagingMaterialId !== undefined) line.packagingMaterialId = parsed.packagingMaterialId ?? null
    if (parsed.componentCode !== undefined) line.componentCode = parsed.componentCode ?? null
    if (parsed.quantity !== undefined) line.quantity = String(parsed.quantity)
    if (parsed.pack !== undefined) line.pack = parsed.pack != null ? String(parsed.pack) : null
    if (parsed.freeQuantity !== undefined) line.freeQuantity = String(parsed.freeQuantity)
    if (parsed.mrp !== undefined) line.mrp = parsed.mrp != null ? String(parsed.mrp) : null
    if (parsed.unit !== undefined) line.unit = parsed.unit
    if (parsed.sequenceNumber !== undefined) line.sequenceNumber = parsed.sequenceNumber

    const wasQcApproved = line.qcApproved
    if (parsed.receivedQuantity !== undefined) line.receivedQuantity = String(parsed.receivedQuantity)
    if (parsed.qcApproved !== undefined) line.qcApproved = parsed.qcApproved
    if (parsed.qcApprovedBy !== undefined) line.qcApprovedBy = parsed.qcApprovedBy ?? null

    const justApproved = !wasQcApproved && line.qcApproved
    if (justApproved) {
      line.qcApprovedAt = new Date()
      const receivedQty = Number(line.receivedQuantity) || 0
      if (receivedQty > 0) {
        const table = line.lineKind === 'raw_material' ? 'dermat_rm_master' : 'dermat_pm_master'
        const materialId = line.lineKind === 'raw_material' ? line.rawMaterialId : line.packagingMaterialId
        if (materialId) {
          await em.getConnection().execute(
            `update ${table} set stock = stock + ? where id = ?`,
            [receivedQty, materialId],
          )
        }
      }
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
      indexer: poLineCrudIndexer,
      events: poLineCrudEvents,
    })

    return { purchaseOrderLineId: line.id }
  },
}

const deletePurchaseOrderLineCommand: CommandHandler<{ id: string }, { purchaseOrderLineId: string }> = {
  id: 'dermat_purchase_orders.purchase_order_lines.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] Purchase order line id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const line = await em.findOne(PurchaseOrderLine, { id })
    if (!line) throw notFound('Purchase order line not found')
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
      indexer: poLineCrudIndexer,
      events: poLineCrudEvents,
    })

    return { purchaseOrderLineId: line.id }
  },
}

registerCommand(createPurchaseOrderLineCommand)
registerCommand(updatePurchaseOrderLineCommand)
registerCommand(deletePurchaseOrderLineCommand)
