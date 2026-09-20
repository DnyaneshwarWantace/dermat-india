import type { CommandHandler } from '@wantace/shared/lib/commands'
import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError } from '@wantace/shared/lib/crud/errors'
import { findOneWithDecryption } from '@wantace/shared/lib/encryption/find'
import { Supplier, SupplierPricing } from '../data/entities'
import {
  createSupplierPricingSchema,
  updateSupplierPricingSchema,
  type CreateSupplierPricingInput,
  type UpdateSupplierPricingInput,
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

async function loadSupplierPricing(em: import('@mikro-orm/postgresql').EntityManager, ctx: import('@wantace/shared/lib/commands').CommandRuntimeContext, id: string) {
  const sp = await findOneWithDecryption(em, SupplierPricing, { id, deletedAt: null }, undefined, resolveScope(ctx))
  if (!sp) throw new CrudHttpError(404, { error: 'Supplier pricing not found.' })
  ensureTenantScope(ctx, sp.tenantId)
  ensureOrganizationScope(ctx, sp.organizationId)
  return sp
}

function snapshotPricing(sp: SupplierPricing) {
  return {
    id: sp.id,
    productVariantId: sp.productVariantId,
    productName: sp.productName,
    productSku: sp.productSku,
    unitPriceCents: sp.unitPriceCents,
    currencyCode: sp.currencyCode,
    minQuantity: sp.minQuantity,
    leadTimeDays: sp.leadTimeDays,
    validFrom: sp.validFrom,
    validTo: sp.validTo,
    isActive: sp.isActive,
    notes: sp.notes,
    organizationId: sp.organizationId,
    tenantId: sp.tenantId,
  }
}

const createSupplierPricingCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.supplier_pricing.create',
    description: 'Create a supplier pricing rule',
    module: 'purchasing',
    features: ['purchasing.supplier_pricing.manage'],
    context: { resourceKind: 'purchasing.supplier_pricing' },
  },
  async execute(input, ctx) {
    const parsed = createSupplierPricingSchema.parse(input) as CreateSupplierPricingInput
    const em = resolveEm(ctx)

    const supplier = await findOneWithDecryption(em, Supplier, { id: parsed.supplierId, deletedAt: null }, undefined, resolveScope(ctx))
    if (!supplier) throw new CrudHttpError(404, { error: 'Supplier not found.' })

    const sp = em.create(SupplierPricing, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      supplier,
      productVariantId: parsed.productVariantId,
      productName: parsed.productName,
      productSku: normalizeOptionalString(parsed.productSku),
      unitPriceCents: parsed.unitPriceCents,
      currencyCode: normalizeOptionalString(parsed.currencyCode),
      minQuantity: parsed.minQuantity ?? '1',
      leadTimeDays: parsed.leadTimeDays ?? null,
      validFrom: parsed.validFrom ?? null,
      validTo: parsed.validTo ?? null,
      isActive: parsed.isActive ?? true,
      notes: normalizeOptionalString(parsed.notes),
    })
    await em.persistAndFlush(sp)
    await emitPurchasingEvent('purchasing.supplier_pricing.created', {
      id: sp.id,
      organizationId: sp.organizationId,
      tenantId: sp.tenantId,
    }, ctx)
    return { supplierPricingId: sp.id }
  },
  async undo(input, ctx) {
    const em = resolveEm(ctx)
    const sp = await loadSupplierPricing(em, ctx, requireId(input?.supplierPricingId, 'SupplierPricing'))
    sp.deletedAt = new Date()
    await em.flush()
  },
}

const updateSupplierPricingCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.supplier_pricing.update',
    description: 'Update a supplier pricing rule',
    module: 'purchasing',
    features: ['purchasing.supplier_pricing.manage'],
    context: { resourceKind: 'purchasing.supplier_pricing' },
  },
  async prepare(input, ctx) {
    const parsed = updateSupplierPricingSchema.parse(input)
    const em = resolveEm(ctx)
    const sp = await loadSupplierPricing(em, ctx, parsed.id)
    return { before: snapshotPricing(sp) }
  },
  async execute(input, ctx) {
    const parsed = updateSupplierPricingSchema.parse(input) as UpdateSupplierPricingInput
    const em = resolveEm(ctx)
    const sp = await loadSupplierPricing(em, ctx, parsed.id)
    if (parsed.productVariantId !== undefined) sp.productVariantId = parsed.productVariantId
    if (parsed.productName !== undefined) sp.productName = parsed.productName
    if (parsed.productSku !== undefined) sp.productSku = normalizeOptionalString(parsed.productSku)
    if (parsed.unitPriceCents !== undefined) sp.unitPriceCents = parsed.unitPriceCents
    if (parsed.currencyCode !== undefined) sp.currencyCode = normalizeOptionalString(parsed.currencyCode)
    if (parsed.minQuantity !== undefined) sp.minQuantity = parsed.minQuantity
    if (parsed.leadTimeDays !== undefined) sp.leadTimeDays = parsed.leadTimeDays ?? null
    if (parsed.validFrom !== undefined) sp.validFrom = parsed.validFrom ?? null
    if (parsed.validTo !== undefined) sp.validTo = parsed.validTo ?? null
    if (parsed.isActive !== undefined) sp.isActive = parsed.isActive
    if (parsed.notes !== undefined) sp.notes = normalizeOptionalString(parsed.notes)
    await em.flush()
    await emitPurchasingEvent('purchasing.supplier_pricing.updated', {
      id: sp.id,
      organizationId: sp.organizationId,
      tenantId: sp.tenantId,
    }, ctx)
    return { ok: true }
  },
}

const deleteSupplierPricingCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.supplier_pricing.delete',
    description: 'Soft-delete a supplier pricing rule',
    module: 'purchasing',
    features: ['purchasing.supplier_pricing.manage'],
    context: { resourceKind: 'purchasing.supplier_pricing' },
  },
  async prepare(input, ctx) {
    const id = requireId(input?.id, 'SupplierPricing')
    const em = resolveEm(ctx)
    const sp = await loadSupplierPricing(em, ctx, id)
    return { before: snapshotPricing(sp) }
  },
  async execute(input, ctx) {
    const id = requireId(input?.id, 'SupplierPricing')
    const em = resolveEm(ctx)
    const sp = await loadSupplierPricing(em, ctx, id)
    sp.deletedAt = new Date()
    await em.flush()
    await emitPurchasingEvent('purchasing.supplier_pricing.deleted', {
      id: sp.id,
      organizationId: sp.organizationId,
      tenantId: sp.tenantId,
    }, ctx)
    return { ok: true }
  },
  async undo(input, ctx) {
    const before = input?.before
    if (!before?.id) return
    const em = resolveEm(ctx)
    const sp = await findOneWithDecryption(em, SupplierPricing, { id: before.id }, undefined, resolveScope(ctx))
    if (!sp) return
    sp.deletedAt = null
    await em.flush()
  },
}

registerCommand(createSupplierPricingCommand)
registerCommand(updateSupplierPricingCommand)
registerCommand(deleteSupplierPricingCommand)
