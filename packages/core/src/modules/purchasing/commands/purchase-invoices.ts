import type { CommandHandler } from '@wantace/shared/lib/commands'
import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError, isUniqueViolation } from '@wantace/shared/lib/crud/errors'
import { findOneWithDecryption } from '@wantace/shared/lib/encryption/find'
import { PurchaseInvoice, PurchaseInvoiceLine, Supplier } from '../data/entities'
import {
  createPurchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
  type CreatePurchaseInvoiceInput,
  type UpdatePurchaseInvoiceInput,
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

async function loadPurchaseInvoice(em: import('@mikro-orm/postgresql').EntityManager, ctx: import('@wantace/shared/lib/commands').CommandRuntimeContext, id: string) {
  const invoice = await findOneWithDecryption(em, PurchaseInvoice, { id, deletedAt: null }, { populate: ['lines'] }, resolveScope(ctx))
  if (!invoice) throw new CrudHttpError(404, { error: 'Purchase invoice not found.' })
  ensureTenantScope(ctx, invoice.tenantId)
  ensureOrganizationScope(ctx, invoice.organizationId)
  return invoice
}

function computeInvoiceTotals(lines: Array<{ unitPriceCents: number; quantity: string; taxRate?: string | null }>) {
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

async function generateInvoiceNumber(em: import('@mikro-orm/postgresql').EntityManager, organizationId: string): Promise<string> {
  const result = await em.getConnection().execute(
    `SELECT COUNT(*)::int as count FROM purchasing_purchase_invoices WHERE organization_id = ?`,
    [organizationId],
  )
  const count = (result[0]?.count ?? 0) + 1
  return `PI-${String(count).padStart(5, '0')}`
}

function snapshotInvoice(inv: PurchaseInvoice) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    supplierInvoiceNumber: inv.supplierInvoiceNumber,
    supplierId: inv.supplierId,
    purchaseOrderId: inv.purchaseOrderId,
    goodsReceiptId: inv.goodsReceiptId,
    status: inv.status,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    currencyCode: inv.currencyCode,
    subtotalCents: inv.subtotalCents,
    taxCents: inv.taxCents,
    totalCents: inv.totalCents,
    paidCents: inv.paidCents,
    balanceCents: inv.balanceCents,
    paymentTerms: inv.paymentTerms,
    notes: inv.notes,
    organizationId: inv.organizationId,
    tenantId: inv.tenantId,
  }
}

const createPurchaseInvoiceCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.purchase_invoices.create',
    description: 'Create a purchase invoice',
    module: 'purchasing',
    features: ['purchasing.purchase_invoices.manage'],
    context: { resourceKind: 'purchasing.purchase_invoice' },
  },
  async execute(input, ctx) {
    const parsed = createPurchaseInvoiceSchema.parse(input) as CreatePurchaseInvoiceInput
    const em = resolveEm(ctx)

    const supplier = await findOneWithDecryption(em, Supplier, {
      id: parsed.supplierId,
      deletedAt: null,
      organizationId: parsed.organizationId,
    }, undefined, resolveScope(ctx))
    if (!supplier) throw new CrudHttpError(400, { error: '[internal] Supplier not found.' })

    const invoiceNumber = await generateInvoiceNumber(em, parsed.organizationId)
    const totals = computeInvoiceTotals(parsed.lines)

    const invoice = em.create(PurchaseInvoice, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      invoiceNumber,
      supplierInvoiceNumber: normalizeOptionalString(parsed.supplierInvoiceNumber),
      supplierId: supplier.id,
      purchaseOrderId: parsed.purchaseOrderId ?? null,
      goodsReceiptId: parsed.goodsReceiptId ?? null,
      status: 'draft',
      invoiceDate: parsed.invoiceDate,
      dueDate: parsed.dueDate ?? null,
      currencyCode: normalizeOptionalString(parsed.currencyCode) ?? supplier.currencyCode ?? null,
      paymentTerms: normalizeOptionalString(parsed.paymentTerms) ?? supplier.paymentTerms ?? null,
      notes: normalizeOptionalString(parsed.notes),
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      balanceCents: totals.totalCents,
    })
    await em.persistAndFlush(invoice)

    for (const line of parsed.lines) {
      const qty = parseFloat(line.quantity) || 0
      const lineTotal = Math.round(line.unitPriceCents * qty)
      em.create(PurchaseInvoiceLine, {
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        purchaseInvoice: invoice,
        purchaseOrderLineId: line.purchaseOrderLineId ?? null,
        lineNumber: line.lineNumber,
        productVariantId: line.productVariantId ?? null,
        productName: line.productName,
        description: normalizeOptionalString(line.description),
        quantity: line.quantity,
        unitOfMeasure: normalizeOptionalString(line.unitOfMeasure),
        unitPriceCents: line.unitPriceCents,
        lineTotal,
        taxRate: line.taxRate ?? null,
        notes: normalizeOptionalString(line.notes),
      })
    }
    await em.flush()

    await emitPurchasingEvent('purchasing.purchase_invoice.created', {
      id: invoice.id,
      organizationId: invoice.organizationId,
      tenantId: invoice.tenantId,
    }, ctx)
    return { purchaseInvoiceId: invoice.id }
  },
  async undo(input, ctx) {
    const em = resolveEm(ctx)
    const invoice = await loadPurchaseInvoice(em, ctx, requireId(input?.purchaseInvoiceId, 'PurchaseInvoice'))
    invoice.deletedAt = new Date()
    await em.flush()
  },
}

const updatePurchaseInvoiceCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.purchase_invoices.update',
    description: 'Update a purchase invoice',
    module: 'purchasing',
    features: ['purchasing.purchase_invoices.manage'],
    context: { resourceKind: 'purchasing.purchase_invoice' },
  },
  async prepare(input, ctx) {
    const parsed = updatePurchaseInvoiceSchema.parse(input)
    const em = resolveEm(ctx)
    const invoice = await loadPurchaseInvoice(em, ctx, parsed.id)
    return { before: snapshotInvoice(invoice) }
  },
  async execute(input, ctx) {
    const parsed = updatePurchaseInvoiceSchema.parse(input) as UpdatePurchaseInvoiceInput
    const em = resolveEm(ctx)
    const invoice = await loadPurchaseInvoice(em, ctx, parsed.id)

    if (invoice.status !== 'draft' && invoice.status !== 'pending_approval') {
      throw new CrudHttpError(400, { error: '[internal] Only draft or pending invoices can be edited.' })
    }

    if (parsed.supplierId !== undefined) invoice.supplierId = parsed.supplierId
    if (parsed.purchaseOrderId !== undefined) invoice.purchaseOrderId = parsed.purchaseOrderId ?? null
    if (parsed.goodsReceiptId !== undefined) invoice.goodsReceiptId = parsed.goodsReceiptId ?? null
    if (parsed.supplierInvoiceNumber !== undefined) invoice.supplierInvoiceNumber = normalizeOptionalString(parsed.supplierInvoiceNumber)
    if (parsed.invoiceDate !== undefined) invoice.invoiceDate = parsed.invoiceDate
    if (parsed.dueDate !== undefined) invoice.dueDate = parsed.dueDate ?? null
    if (parsed.currencyCode !== undefined) invoice.currencyCode = normalizeOptionalString(parsed.currencyCode)
    if (parsed.paymentTerms !== undefined) invoice.paymentTerms = normalizeOptionalString(parsed.paymentTerms)
    if (parsed.notes !== undefined) invoice.notes = normalizeOptionalString(parsed.notes)

    if (parsed.lines) {
      for (const existing of invoice.lines.getItems()) {
        em.remove(existing)
      }
      const totals = computeInvoiceTotals(parsed.lines)
      invoice.subtotalCents = totals.subtotalCents
      invoice.taxCents = totals.taxCents
      invoice.totalCents = totals.totalCents
      invoice.balanceCents = totals.totalCents - invoice.paidCents

      for (const line of parsed.lines) {
        const qty = parseFloat(line.quantity) || 0
        const lineTotal = Math.round(line.unitPriceCents * qty)
        em.create(PurchaseInvoiceLine, {
          organizationId: invoice.organizationId,
          tenantId: invoice.tenantId,
          purchaseInvoice: invoice,
          purchaseOrderLineId: line.purchaseOrderLineId ?? null,
          lineNumber: line.lineNumber,
          productVariantId: line.productVariantId ?? null,
          productName: line.productName,
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

    try {
      await em.flush()
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new CrudHttpError(409, { error: '[internal] Invoice number already exists in this organization.' })
      }
      throw err
    }
    await emitPurchasingEvent('purchasing.purchase_invoice.updated', {
      id: invoice.id,
      organizationId: invoice.organizationId,
      tenantId: invoice.tenantId,
    }, ctx)
    return { ok: true }
  },
}

const approvePurchaseInvoiceCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.purchase_invoices.approve',
    description: 'Approve a purchase invoice',
    module: 'purchasing',
    features: ['purchasing.purchase_invoices.approve'],
    context: { resourceKind: 'purchasing.purchase_invoice' },
  },
  async execute(input, ctx) {
    const id = requireId(input?.id, 'PurchaseInvoice')
    const em = resolveEm(ctx)
    const invoice = await loadPurchaseInvoice(em, ctx, id)

    if (invoice.status !== 'draft' && invoice.status !== 'pending_approval') {
      throw new CrudHttpError(400, { error: '[internal] Only draft or pending invoices can be approved.' })
    }

    invoice.status = 'approved'
    invoice.approvedByUserId = ctx.auth?.userId ?? null
    invoice.approvedAt = new Date()
    await em.flush()

    await emitPurchasingEvent('purchasing.purchase_invoice.approved', {
      id: invoice.id,
      organizationId: invoice.organizationId,
      tenantId: invoice.tenantId,
    }, ctx)
    return { ok: true }
  },
}

const deletePurchaseInvoiceCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.purchase_invoices.delete',
    description: 'Soft-delete a purchase invoice',
    module: 'purchasing',
    features: ['purchasing.purchase_invoices.manage'],
    context: { resourceKind: 'purchasing.purchase_invoice' },
  },
  async prepare(input, ctx) {
    const id = requireId(input?.id, 'PurchaseInvoice')
    const em = resolveEm(ctx)
    const invoice = await loadPurchaseInvoice(em, ctx, id)
    return { before: snapshotInvoice(invoice) }
  },
  async execute(input, ctx) {
    const id = requireId(input?.id, 'PurchaseInvoice')
    const em = resolveEm(ctx)
    const invoice = await loadPurchaseInvoice(em, ctx, id)

    if (invoice.status === 'paid') {
      throw new CrudHttpError(400, { error: '[internal] Paid invoices cannot be deleted.' })
    }

    invoice.deletedAt = new Date()
    await em.flush()
    await emitPurchasingEvent('purchasing.purchase_invoice.cancelled', {
      id: invoice.id,
      organizationId: invoice.organizationId,
      tenantId: invoice.tenantId,
    }, ctx)
    return { ok: true }
  },
  async undo(input, ctx) {
    const before = input?.before
    if (!before?.id) return
    const em = resolveEm(ctx)
    const invoice = await findOneWithDecryption(em, PurchaseInvoice, { id: before.id }, undefined, resolveScope(ctx))
    if (!invoice) return
    invoice.deletedAt = null
    await em.flush()
  },
}

registerCommand(createPurchaseInvoiceCommand)
registerCommand(updatePurchaseInvoiceCommand)
registerCommand(approvePurchaseInvoiceCommand)
registerCommand(deletePurchaseInvoiceCommand)
