import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError, notFound } from '@open-mercato/shared/lib/crud/errors'
import type { CrudIndexerConfig, CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { PurchaseOrder } from '../data/entities'
import {
  purchaseOrderCreateSchema,
  purchaseOrderUpdateSchema,
  type PurchaseOrderCreateInput,
  type PurchaseOrderUpdateInput,
} from '../data/validators'
import { generatePoNumber } from '../lib/generatePoNumber'

const poCrudIndexer: CrudIndexerConfig<PurchaseOrder> = {
  entityType: (E as { dermat_purchase_orders?: { purchase_order?: string } }).dermat_purchase_orders?.purchase_order
    ?? 'dermat_purchase_orders:purchase_order',
}

const poCrudEvents: CrudEventsConfig = {
  module: 'dermat_purchase_orders',
  entity: 'purchase_order',
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

const createPurchaseOrderCommand: CommandHandler<PurchaseOrderCreateInput, { purchaseOrderId: string; poNumber: string }> = {
  id: 'dermat_purchase_orders.purchase_orders.create',
  async execute(rawInput, ctx) {
    const parsed = purchaseOrderCreateSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const poNumber = await generatePoNumber(em, parsed.organizationId, parsed.tenantId)

    const po = em.create(PurchaseOrder, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      poNumber,
      department: parsed.department,
      vendorId: parsed.vendorId,
      bomId: parsed.bomId ?? null,
      gstNumber: parsed.gstNumber ?? null,
      paymentTerms: parsed.paymentTerms ?? null,
      poDate: parsed.poDate,
      deliveryDate: parsed.deliveryDate ?? null,
      billingAddress: parsed.billingAddress ?? null,
      deliveryAddress: parsed.deliveryAddress ?? null,
      status: parsed.status ?? 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(po)
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: po,
      identifiers: {
        id: po.id,
        organizationId: po.organizationId,
        tenantId: po.tenantId,
      },
      indexer: poCrudIndexer,
      events: poCrudEvents,
    })

    return { purchaseOrderId: po.id, poNumber: po.poNumber }
  },
}

const updatePurchaseOrderCommand: CommandHandler<PurchaseOrderUpdateInput, { purchaseOrderId: string }> = {
  id: 'dermat_purchase_orders.purchase_orders.update',
  async execute(rawInput, ctx) {
    const parsed = purchaseOrderUpdateSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const po = await em.findOne(PurchaseOrder, { id: parsed.id })
    if (!po) throw notFound('Purchase order not found')
    ensureTenantScope(ctx, po.tenantId)
    ensureOrganizationScope(ctx, po.organizationId)

    if (parsed.department !== undefined) po.department = parsed.department
    if (parsed.vendorId !== undefined) po.vendorId = parsed.vendorId
    if (parsed.bomId !== undefined) po.bomId = parsed.bomId ?? null
    if (parsed.gstNumber !== undefined) po.gstNumber = parsed.gstNumber ?? null
    if (parsed.paymentTerms !== undefined) po.paymentTerms = parsed.paymentTerms ?? null
    if (parsed.poDate !== undefined) po.poDate = parsed.poDate
    if (parsed.deliveryDate !== undefined) po.deliveryDate = parsed.deliveryDate ?? null
    if (parsed.billingAddress !== undefined) po.billingAddress = parsed.billingAddress ?? null
    if (parsed.deliveryAddress !== undefined) po.deliveryAddress = parsed.deliveryAddress ?? null
    if (parsed.status !== undefined) po.status = parsed.status

    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: po,
      identifiers: {
        id: po.id,
        organizationId: po.organizationId,
        tenantId: po.tenantId,
      },
      indexer: poCrudIndexer,
      events: poCrudEvents,
    })

    return { purchaseOrderId: po.id }
  },
}

const deletePurchaseOrderCommand: CommandHandler<{ id: string }, { purchaseOrderId: string }> = {
  id: 'dermat_purchase_orders.purchase_orders.delete',
  async execute(rawInput, ctx) {
    const id = typeof rawInput?.id === 'string' ? rawInput.id : null
    if (!id) throw new CrudHttpError(400, { error: '[internal] Purchase order id is required' })
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const po = await em.findOne(PurchaseOrder, { id })
    if (!po) throw notFound('Purchase order not found')
    ensureTenantScope(ctx, po.tenantId)
    ensureOrganizationScope(ctx, po.organizationId)

    po.deletedAt = new Date()
    await em.flush()

    const de = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: po,
      identifiers: {
        id: po.id,
        organizationId: po.organizationId,
        tenantId: po.tenantId,
      },
      indexer: poCrudIndexer,
      events: poCrudEvents,
    })

    return { purchaseOrderId: po.id }
  },
}

registerCommand(createPurchaseOrderCommand)
registerCommand(updatePurchaseOrderCommand)
registerCommand(deletePurchaseOrderCommand)
