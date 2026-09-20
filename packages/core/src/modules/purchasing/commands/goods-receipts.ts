import type { CommandHandler } from '@wantace/shared/lib/commands'
import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError, isUniqueViolation } from '@wantace/shared/lib/crud/errors'
import { findOneWithDecryption } from '@wantace/shared/lib/encryption/find'
import { GoodsReceipt, GoodsReceiptLine, PurchaseOrder, PurchaseOrderLine } from '../data/entities'
import {
  createGoodsReceiptSchema,
  type CreateGoodsReceiptInput,
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

async function generateReceiptNumber(em: import('@mikro-orm/postgresql').EntityManager, organizationId: string): Promise<string> {
  const result = await em.getConnection().execute(
    `SELECT COUNT(*)::int as count FROM purchasing_goods_receipts WHERE organization_id = ?`,
    [organizationId],
  )
  const count = (result[0]?.count ?? 0) + 1
  return `GR-${String(count).padStart(5, '0')}`
}

const createGoodsReceiptCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.goods_receipts.create',
    description: 'Create a goods receipt against a purchase order',
    module: 'purchasing',
    features: ['purchasing.goods_receipts.manage'],
    context: { resourceKind: 'purchasing.goods_receipt' },
  },
  async execute(input, ctx) {
    const parsed = createGoodsReceiptSchema.parse(input) as CreateGoodsReceiptInput
    const em = resolveEm(ctx)

    const po = await findOneWithDecryption(em, PurchaseOrder, {
      id: parsed.purchaseOrderId,
      deletedAt: null,
      organizationId: parsed.organizationId,
    }, { populate: ['lines'] }, resolveScope(ctx))
    if (!po) throw new CrudHttpError(400, { error: '[internal] Purchase order not found.' })

    if (!['confirmed', 'partially_received', 'sent'].includes(po.status)) {
      throw new CrudHttpError(400, { error: '[internal] Purchase order is not in a receivable state.' })
    }

    const receiptNumber = await generateReceiptNumber(em, parsed.organizationId)

    const gr = em.create(GoodsReceipt, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      receiptNumber,
      purchaseOrder: po,
      status: 'draft',
      receiptDate: parsed.receiptDate,
      warehouseId: parsed.warehouseId ?? po.warehouseId ?? null,
      receivedByUserId: ctx.auth?.userId ?? null,
      notes: normalizeOptionalString(parsed.notes),
    })

    for (const line of parsed.lines) {
      em.create(GoodsReceiptLine, {
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        goodsReceipt: gr,
        purchaseOrderLineId: line.purchaseOrderLineId,
        productVariantId: line.productVariantId ?? null,
        productName: line.productName,
        receivedQuantity: line.receivedQuantity,
        acceptedQuantity: line.acceptedQuantity ?? line.receivedQuantity,
        rejectedQuantity: line.rejectedQuantity ?? '0',
        batchNumber: normalizeOptionalString(line.batchNumber),
        lotNumber: normalizeOptionalString(line.lotNumber),
        expiryDate: line.expiryDate ?? null,
        warehouseLocationId: line.warehouseLocationId ?? null,
        notes: normalizeOptionalString(line.notes),
      })
    }

    try {
      await em.flush()
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new CrudHttpError(409, { error: '[internal] Receipt number conflict. Please retry.' })
      }
      throw err
    }

    await emitPurchasingEvent('purchasing.goods_receipt.created', {
      id: gr.id,
      organizationId: gr.organizationId,
      tenantId: gr.tenantId,
    }, ctx)

    return { goodsReceiptId: gr.id, receiptNumber: gr.receiptNumber }
  },
}

const completeGoodsReceiptCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.goods_receipts.complete',
    description: 'Complete a goods receipt and update PO line received quantities',
    module: 'purchasing',
    features: ['purchasing.goods_receipts.manage'],
    context: { resourceKind: 'purchasing.goods_receipt' },
  },
  async execute(input, ctx) {
    const id = requireId(input?.id, 'GoodsReceipt')
    const em = resolveEm(ctx)

    const gr = await findOneWithDecryption(em, GoodsReceipt, {
      id,
      deletedAt: null,
    }, { populate: ['lines'] }, resolveScope(ctx))
    if (!gr) throw new CrudHttpError(404, { error: 'Goods receipt not found.' })
    ensureTenantScope(ctx, gr.tenantId)
    ensureOrganizationScope(ctx, gr.organizationId)

    if (gr.status !== 'draft') {
      throw new CrudHttpError(400, { error: '[internal] Goods receipt is already completed or cancelled.' })
    }

    gr.status = 'completed'

    for (const grLine of gr.lines.getItems()) {
      const poLine = await findOneWithDecryption(em, PurchaseOrderLine, {
        id: grLine.purchaseOrderLineId,
        deletedAt: null,
      }, undefined, resolveScope(ctx))
      if (poLine) {
        const prevReceived = parseFloat(poLine.receivedQuantity) || 0
        const accepted = parseFloat(grLine.acceptedQuantity) || 0
        poLine.receivedQuantity = String(prevReceived + accepted)
        const ordered = parseFloat(poLine.quantity) || 0
        poLine.status = (prevReceived + accepted) >= ordered ? 'received' : 'partially_received'
      }
    }

    const po = await findOneWithDecryption(em, PurchaseOrder, {
      id: (gr.purchaseOrder as any)?.id ?? (gr as any).purchaseOrder,
      deletedAt: null,
    }, { populate: ['lines'] }, resolveScope(ctx))

    if (po) {
      const allReceived = po.lines.getItems().every(l => l.status === 'received' || l.status === 'cancelled')
      const anyReceived = po.lines.getItems().some(l => l.status === 'received' || l.status === 'partially_received')
      if (allReceived) {
        po.status = 'received'
      } else if (anyReceived) {
        po.status = 'partially_received'
      }
    }

    await em.flush()

    await emitPurchasingEvent('purchasing.goods_receipt.completed', {
      id: gr.id,
      organizationId: gr.organizationId,
      tenantId: gr.tenantId,
    }, ctx)

    return { ok: true }
  },
}

registerCommand(createGoodsReceiptCommand)
registerCommand(completeGoodsReceiptCommand)
