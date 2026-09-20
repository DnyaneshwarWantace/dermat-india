import type { CommandHandler } from '@wantace/shared/lib/commands'
import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError, isUniqueViolation } from '@wantace/shared/lib/crud/errors'
import { findOneWithDecryption } from '@wantace/shared/lib/encryption/find'
import { resolveTranslations } from '@wantace/shared/lib/i18n/server'
import { Supplier } from '../data/entities'
import {
  createSupplierSchema,
  updateSupplierSchema,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from '../data/validators'
import { emitPurchasingEvent } from '../events'
import {
  ensureTenantScope,
  ensureOrganizationScope,
  normalizeOptionalString,
  requireId,
  resolveScope,
  resolveEm,
  toJsonValue,
} from './shared'

async function loadSupplier(em: import('@mikro-orm/postgresql').EntityManager, ctx: import('@wantace/shared/lib/commands').CommandRuntimeContext, id: string) {
  const supplier = await findOneWithDecryption(em, Supplier, { id, deletedAt: null }, undefined, resolveScope(ctx))
  if (!supplier) throw new CrudHttpError(404, { error: 'Supplier not found.' })
  ensureTenantScope(ctx, supplier.tenantId)
  ensureOrganizationScope(ctx, supplier.organizationId)
  return supplier
}

function snapshotSupplier(s: Supplier) {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    description: s.description,
    status: s.status,
    isActive: s.isActive,
    contactName: s.contactName,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    website: s.website,
    taxId: s.taxId,
    addressLine1: s.addressLine1,
    addressLine2: s.addressLine2,
    city: s.city,
    state: s.state,
    postalCode: s.postalCode,
    country: s.country,
    currencyCode: s.currencyCode,
    paymentTerms: s.paymentTerms,
    leadTimeDays: s.leadTimeDays,
    notes: s.notes,
    metadata: s.metadata,
    organizationId: s.organizationId,
    tenantId: s.tenantId,
  }
}

const createSupplierCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.suppliers.create',
    description: 'Create a supplier',
    module: 'purchasing',
    features: ['purchasing.suppliers.manage'],
    context: { resourceKind: 'purchasing.supplier' },
  },
  async execute(input, ctx) {
    const parsed = createSupplierSchema.parse(input) as CreateSupplierInput
    const em = resolveEm(ctx)
    const supplier = em.create(Supplier, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      code: parsed.code,
      description: normalizeOptionalString(parsed.description),
      status: parsed.status ?? 'active',
      contactName: normalizeOptionalString(parsed.contactName),
      contactEmail: normalizeOptionalString(parsed.contactEmail),
      contactPhone: normalizeOptionalString(parsed.contactPhone),
      website: normalizeOptionalString(parsed.website),
      taxId: normalizeOptionalString(parsed.taxId),
      addressLine1: normalizeOptionalString(parsed.addressLine1),
      addressLine2: normalizeOptionalString(parsed.addressLine2),
      city: normalizeOptionalString(parsed.city),
      state: normalizeOptionalString(parsed.state),
      postalCode: normalizeOptionalString(parsed.postalCode),
      country: normalizeOptionalString(parsed.country),
      currencyCode: normalizeOptionalString(parsed.currencyCode),
      paymentTerms: normalizeOptionalString(parsed.paymentTerms),
      leadTimeDays: parsed.leadTimeDays ?? null,
      notes: normalizeOptionalString(parsed.notes),
    })
    try {
      await em.persistAndFlush(supplier)
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new CrudHttpError(409, { error: '[internal] Supplier code already exists in this organization.' })
      }
      throw err
    }
    await emitPurchasingEvent('purchasing.supplier.created', {
      id: supplier.id,
      organizationId: supplier.organizationId,
      tenantId: supplier.tenantId,
    }, ctx)
    return { supplierId: supplier.id }
  },
  async undo(input, ctx) {
    const em = resolveEm(ctx)
    const supplier = await loadSupplier(em, ctx, requireId(input?.supplierId, 'Supplier'))
    supplier.deletedAt = new Date()
    await em.flush()
  },
}

const updateSupplierCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.suppliers.update',
    description: 'Update a supplier',
    module: 'purchasing',
    features: ['purchasing.suppliers.manage'],
    context: { resourceKind: 'purchasing.supplier' },
  },
  async prepare(input, ctx) {
    const parsed = updateSupplierSchema.parse(input)
    const em = resolveEm(ctx)
    const supplier = await loadSupplier(em, ctx, parsed.id)
    return { before: snapshotSupplier(supplier) }
  },
  async execute(input, ctx) {
    const parsed = updateSupplierSchema.parse(input) as UpdateSupplierInput
    const em = resolveEm(ctx)
    const supplier = await loadSupplier(em, ctx, parsed.id)
    if (parsed.name !== undefined) supplier.name = parsed.name
    if (parsed.code !== undefined) supplier.code = parsed.code
    if (parsed.description !== undefined) supplier.description = normalizeOptionalString(parsed.description)
    if (parsed.status !== undefined) supplier.status = parsed.status
    if (parsed.contactName !== undefined) supplier.contactName = normalizeOptionalString(parsed.contactName)
    if (parsed.contactEmail !== undefined) supplier.contactEmail = normalizeOptionalString(parsed.contactEmail)
    if (parsed.contactPhone !== undefined) supplier.contactPhone = normalizeOptionalString(parsed.contactPhone)
    if (parsed.website !== undefined) supplier.website = normalizeOptionalString(parsed.website)
    if (parsed.taxId !== undefined) supplier.taxId = normalizeOptionalString(parsed.taxId)
    if (parsed.addressLine1 !== undefined) supplier.addressLine1 = normalizeOptionalString(parsed.addressLine1)
    if (parsed.addressLine2 !== undefined) supplier.addressLine2 = normalizeOptionalString(parsed.addressLine2)
    if (parsed.city !== undefined) supplier.city = normalizeOptionalString(parsed.city)
    if (parsed.state !== undefined) supplier.state = normalizeOptionalString(parsed.state)
    if (parsed.postalCode !== undefined) supplier.postalCode = normalizeOptionalString(parsed.postalCode)
    if (parsed.country !== undefined) supplier.country = normalizeOptionalString(parsed.country)
    if (parsed.currencyCode !== undefined) supplier.currencyCode = normalizeOptionalString(parsed.currencyCode)
    if (parsed.paymentTerms !== undefined) supplier.paymentTerms = normalizeOptionalString(parsed.paymentTerms)
    if (parsed.leadTimeDays !== undefined) supplier.leadTimeDays = parsed.leadTimeDays ?? null
    if (parsed.notes !== undefined) supplier.notes = normalizeOptionalString(parsed.notes)
    try {
      await em.flush()
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new CrudHttpError(409, { error: '[internal] Supplier code already exists in this organization.' })
      }
      throw err
    }
    await emitPurchasingEvent('purchasing.supplier.updated', {
      id: supplier.id,
      organizationId: supplier.organizationId,
      tenantId: supplier.tenantId,
    }, ctx)
    return { ok: true }
  },
}

const deleteSupplierCommand: CommandHandler = {
  metadata: {
    id: 'purchasing.suppliers.delete',
    description: 'Soft-delete a supplier',
    module: 'purchasing',
    features: ['purchasing.suppliers.manage'],
    context: { resourceKind: 'purchasing.supplier' },
  },
  async prepare(input, ctx) {
    const id = requireId(input?.id, 'Supplier')
    const em = resolveEm(ctx)
    const supplier = await loadSupplier(em, ctx, id)
    return { before: snapshotSupplier(supplier) }
  },
  async execute(input, ctx) {
    const id = requireId(input?.id, 'Supplier')
    const em = resolveEm(ctx)
    const supplier = await loadSupplier(em, ctx, id)
    supplier.deletedAt = new Date()
    await em.flush()
    await emitPurchasingEvent('purchasing.supplier.deleted', {
      id: supplier.id,
      organizationId: supplier.organizationId,
      tenantId: supplier.tenantId,
    }, ctx)
    return { ok: true }
  },
  async undo(input, ctx) {
    const before = input?.before
    if (!before?.id) return
    const em = resolveEm(ctx)
    const supplier = await findOneWithDecryption(em, Supplier, { id: before.id }, undefined, resolveScope(ctx))
    if (!supplier) return
    supplier.deletedAt = null
    await em.flush()
  },
}

registerCommand(createSupplierCommand)
registerCommand(updateSupplierCommand)
registerCommand(deleteSupplierCommand)
