import type { CommandHandler } from '@wantace/shared/lib/commands'
import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError, isUniqueViolation } from '@wantace/shared/lib/crud/errors'
import { findOneWithDecryption } from '@wantace/shared/lib/encryption/find'
import { PurchaseOrder, PurchaseOrderLine, Supplier } from '../data/entities'
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  type CreatePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
} from '../data/validators'
import { emitPurchasingEvent } from '../events'
import {
  ensureTenantScope,
  ensureOrganizationScope,
  normalizeOptionalString,
  requireId,
  resolveScope,
  resolveEm,
} from './shared'

async function loadPurchaseOrder(em: import('@mikro-orm/postgresql').EntityManager, ctx: import('@wantace/shared/lib/commands').CommandRuntimeContext, id: string) {
  const po = await findOneWithDecryption(em, PurchaseOrder, { id, deletedAt: null }, { populate: ['lines'] }, resolveScope(ctx))
  if (!po) throw new CrudHttpError(404, { error: 'Purchase order not found.' })
  ensureTenantScope(ctx, po.tenantId)
  ensureOrganizationScope(ctx, po.organizationId)
  return po
}

function computeTotals(lines: Array<{ unitPriceCents: number; quantity: string; taxRate?: string | null }>) {
  let subtotal = 0
  let tax = 0
  for (const line of lines) {
    const qty = parseFloat(line.quantity) || 0
    const lineTotal = Math.round(line.unitPriceCents * qty)
    subtotal += lineTotal
    if (line.taxRate) {
      const rate = parseFloat(line.taxRate) || 0
      tax += Math.round(lineTotal * rate / 100)
    }
  }
  return { subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax }
}

async function generateOrderNumber(em: import('@mikro-orm/postgresql').EntityManager, organizationId: string): Promise<string> {
  const result = await em.getConnection().execute(
    `SELECT COUNT(*)::int as count FROM purchasing_purchase_orders WHERE organization_id = ?`,
    [organizationId],
  )
  const count = (result[0]?.count ?? 0) + 1
  return `PO-${String(count).padStart(5, '0')}`
}

const createPurchaseOrderCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.purchase_orders.create',
    description: 'Create a purchase order',
    module: 'purchasing',
    features: ['purchasing.purchase_orders.manage'],
    context: { resourceKind: 'purchasing.purchase_order' },
  },
  async execute(input, ctx) {
    const parsed = createPurchaseOrderSchema.parse(input) as CreatePurchaseOrderInput
    const em = resolveEm(ctx)

    const supplier = await findOneWithDecryption(em, Supplier, {
      id: parsed.supplierId,
      deletedAt: null,
      organizationId: parsed.organizationId,
    }, undefined, resolveScope(ctx))
    if (!supplier) throw new CrudHttpError(400, { error: '[internal] Supplier not found.' })

    const orderNumber = await generateOrderNumber(em, parsed.organizationId)
    const totals = computeTotals(parsed.lines)

    const po = em.create(PurchaseOrder, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      orderNumber,
      supplier,
      status: 'draft',
      orderDate: parsed.orderDate,
      expectedDeliveryDate: parsed.expectedDeliveryDate ?? null,
      warehouseId: parsed.warehouseId ?? null,
      currencyCode: normalizeOptionalString(parsed.currencyCode) ?? supplier.currencyCode ?? null,
      paymentTerms: normalizeOptionalString(parsed.paymentTerms) ?? supplier.paymentTerms ?? null,
      shippingMethod: normalizeOptionalString(parsed.shippingMethod),
      notes: normalizeOptionalString(parsed.notes),
      createdByUserId: ctx.auth?.userId ?? null,
      ...totals,
    })

    for (const line of parsed.lines) {
      const qty = parseFloat(line.quantity) || 0
      const lineTotal = Math.round(line.unitPriceCents * qty)
      em.create(PurchaseOrderLine, {
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        purchaseOrder: po,
        lineNumber: line.lineNumber,
        productVariantId: line.productVariantId ?? null,
        productName: line.productName,
        productSku: normalizeOptionalString(line.productSku),
        description: normalizeOptionalString(line.description),
        quantity: line.quantity,
        unitOfMeasure: normalizeOptionalString(line.unitOfMeasure),
        unitPriceCents: line.unitPriceCents,
        lineTotal,
        taxRate: line.taxRate ?? null,
        notes: normalizeOptionalString(line.notes),
      })
    }

    try {
      await em.flush()
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new CrudHttpError(409, { error: '[internal] Order number conflict. Please retry.' })
      }
      throw err
    }

    await emitPurchasingEvent('purchasing.purchase_order.created', {
      id: po.id,
      organizationId: po.organizationId,
      tenantId: po.tenantId,
    }, ctx)

    return { purchaseOrderId: po.id, orderNumber: po.orderNumber }
  },
  async undo(input, ctx) {
    const em = resolveEm(ctx)
    const po = await loadPurchaseOrder(em, ctx, requireId(input?.purchaseOrderId, 'PurchaseOrder'))
    po.deletedAt = new Date()
    for (const line of po.lines.getItems()) {
      line.deletedAt = new Date()
    }
    await em.flush()
  },
}

const updatePurchaseOrderCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.purchase_orders.update',
    description: 'Update a purchase order',
    module: 'purchasing',
    features: ['purchasing.purchase_orders.manage'],
    context: { resourceKind: 'purchasing.purchase_order' },
  },
  async execute(input, ctx) {
    const parsed = updatePurchaseOrderSchema.parse(input) as UpdatePurchaseOrderInput
    const em = resolveEm(ctx)
    const po = await loadPurchaseOrder(em, ctx, parsed.id)

    if (po.status !== 'draft' && parsed.status === undefined) {
      throw new CrudHttpError(400, { error: '[internal] Only draft purchase orders can be edited.' })
    }

    if (parsed.status !== undefined) po.status = parsed.status
    if (parsed.orderDate !== undefined) po.orderDate = parsed.orderDate
    if (parsed.expectedDeliveryDate !== undefined) po.expectedDeliveryDate = parsed.expectedDeliveryDate ?? null
    if (parsed.warehouseId !== undefined) po.warehouseId = parsed.warehouseId ?? null
    if (parsed.currencyCode !== undefined) po.currencyCode = normalizeOptionalString(parsed.currencyCode)
    if (parsed.paymentTerms !== undefined) po.paymentTerms = normalizeOptionalString(parsed.paymentTerms)
    if (parsed.shippingMethod !== undefined) po.shippingMethod = normalizeOptionalString(parsed.shippingMethod)
    if (parsed.notes !== undefined) po.notes = normalizeOptionalString(parsed.notes)

    if (parsed.lines) {
      for (const existing of po.lines.getItems()) {
        em.remove(existing)
      }
      const totals = computeTotals(parsed.lines)
      po.subtotalCents = totals.subtotalCents
      po.taxCents = totals.taxCents
      po.totalCents = totals.totalCents

      for (const line of parsed.lines) {
        const qty = parseFloat(line.quantity) || 0
        const lineTotal = Math.round(line.unitPriceCents * qty)
        em.create(PurchaseOrderLine, {
          organizationId: po.organizationId,
          tenantId: po.tenantId,
          purchaseOrder: po,
          lineNumber: line.lineNumber,
          productVariantId: line.productVariantId ?? null,
          productName: line.productName,
          productSku: normalizeOptionalString(line.productSku),
          description: normalizeOptionalString(line.description),
          quantity: line.quantity,
          unitOfMeasure: normalizeOptionalString(line.unitOfMeasure),
          unitPriceCents: line.unitPriceCents,
          lineTotal,
          taxRate: line.taxRate ?? null,
          notes: normalizeOptionalString(line.notes),
        })
      }
    }

    await em.flush()

    const eventId = parsed.status === 'sent' ? 'purchasing.purchase_order.sent'
      : parsed.status === 'confirmed' ? 'purchasing.purchase_order.confirmed'
      : parsed.status === 'cancelled' ? 'purchasing.purchase_order.cancelled'
      : parsed.status === 'closed' ? 'purchasing.purchase_order.closed'
      : 'purchasing.purchase_order.updated'

    await emitPurchasingEvent(eventId, {
      id: po.id,
      organizationId: po.organizationId,
      tenantId: po.tenantId,
    }, ctx)

    return { ok: true }
  },
}

const deletePurchaseOrderCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.purchase_orders.delete',
    description: 'Soft-delete a purchase order',
    module: 'purchasing',
    features: ['purchasing.purchase_orders.manage'],
    context: { resourceKind: 'purchasing.purchase_order' },
  },
  async execute(input, ctx) {
    const id = requireId(input?.id, 'PurchaseOrder')
    const em = resolveEm(ctx)
    const po = await loadPurchaseOrder(em, ctx, id)

    if (po.status !== 'draft') {
      throw new CrudHttpError(400, { error: '[internal] Only draft purchase orders can be deleted.' })
    }

    po.deletedAt = new Date()
    for (const line of po.lines.getItems()) {
      line.deletedAt = new Date()
    }
    await em.flush()

    await emitPurchasingEvent('purchasing.purchase_order.deleted', {
      id: po.id,
      organizationId: po.organizationId,
      tenantId: po.tenantId,
    }, ctx)

    return { ok: true }
  },
}

registerCommand(createPurchaseOrderCommand)
registerCommand(updatePurchaseOrderCommand)
registerCommand(deletePurchaseOrderCommand)
