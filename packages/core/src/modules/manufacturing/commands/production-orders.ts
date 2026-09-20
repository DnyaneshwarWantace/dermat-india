import { registerCommand } from '@wantace/shared/lib/commands'
import { CrudHttpError } from '@wantace/shared/lib/crud/errors'
import { ProductionOrder, ProductionStage, ProductionStageTemplate, BillOfMaterials, BOMLine, MaterialConsumption } from '../data/entities'
import { createProductionOrderSchema, updateProductionOrderSchema, deleteProductionOrderSchema } from '../data/validators'
import { ensureTenantScope, resolveEm, resolveScope } from './shared'
import { emitManufacturingEvent } from '../events'

async function generateOrderNumber(em: ReturnType<typeof resolveEm>, organizationId: string): Promise<string> {
  const count = await em.count(ProductionOrder, { organizationId })
  return `PO-${String(count + 1).padStart(5, '0')}`
}

registerCommand({
  id: 'manufacturing.production_order.create',
  features: ['manufacturing.production_orders.manage'],
  execute: async (payload, ctx) => {
    const parsed = createProductionOrderSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const orderNumber = await generateOrderNumber(em, parsed.organizationId)
    const order = em.create(ProductionOrder, {
      ...parsed,
      orderNumber,
      status: 'draft',
      producedQuantity: '0',
      rejectedQuantity: '0',
      materialCostCents: 0,
      laborCostCents: 0,
      overheadCostCents: 0,
      totalCostCents: 0,
    })
    await em.flush()

    const templates = await em.find(ProductionStageTemplate, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      isActive: true,
      deletedAt: null,
    }, { orderBy: { sequenceNumber: 'asc' } })

    for (const tmpl of templates) {
      em.create(ProductionStage, {
        productionOrder: order.id as any,
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        sequenceNumber: tmpl.sequenceNumber,
        name: tmpl.name,
        description: tmpl.description,
        workCenterId: tmpl.defaultWorkCenterId,
        machineId: tmpl.defaultMachineId,
        plannedQuantity: parsed.plannedQuantity,
        producedQuantity: '0',
        rejectedQuantity: '0',
        plannedSetupMinutes: tmpl.estimatedSetupMinutes,
        plannedRunMinutes: tmpl.estimatedRunMinutes,
        actualSetupMinutes: '0',
        actualRunMinutes: '0',
        status: 'pending',
      })
    }
    if (templates.length) await em.flush()

    const bom = await em.findOne(BillOfMaterials, { id: parsed.bomId, deletedAt: null })
    if (bom) {
      const bomLines = await em.find(BOMLine, { bom: parsed.bomId as any, deletedAt: null }, { orderBy: { lineNumber: 'asc' } })
      const scale = parseFloat(parsed.plannedQuantity) / (parseFloat(bom.outputQuantity) || 1)
      for (const line of bomLines) {
        const baseQty = parseFloat(line.quantity) * scale
        const wastage = parseFloat(line.wastagePercent || '0') / 100
        const plannedQty = baseQty * (1 + wastage)
        em.create(MaterialConsumption, {
          productionOrder: order.id as any,
          organizationId: parsed.organizationId,
          tenantId: parsed.tenantId,
          bomLineId: line.id,
          productVariantId: line.productVariantId,
          productName: line.productName,
          productSku: line.productSku ?? null,
          plannedQuantity: plannedQty.toFixed(4),
          actualQuantity: '0',
          wastageQuantity: '0',
          unitOfMeasure: line.unitOfMeasure ?? null,
          unitCostCents: line.unitCostCents,
          status: 'planned',
        })
      }
      if (bomLines.length) await em.flush()
    }

    void emitManufacturingEvent('manufacturing.production_order.created', {
      id: order.id,
      bomId: parsed.bomId,
      orderNumber,
      productName: parsed.productName,
      plannedQuantity: Number(parsed.plannedQuantity),
      salesOrderId: parsed.salesOrderId ?? null,
      salesOrderNumber: parsed.salesOrderNumber ?? null,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })

    return { productionOrderId: order.id, orderNumber }
  },
})

registerCommand({
  id: 'manufacturing.production_order.update',
  features: ['manufacturing.production_orders.manage'],
  execute: async (payload, ctx) => {
    const parsed = updateProductionOrderSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const order = await em.findOneOrFail(ProductionOrder, { id: parsed.id, organizationId: parsed.organizationId, deletedAt: null })
    if (order.status === 'cancelled') throw new CrudHttpError(400, { error: 'Cannot update a cancelled production order.' })

    const previousStatus = order.status

    if (parsed.status) order.status = parsed.status
    if (parsed.priority) order.priority = parsed.priority
    if (parsed.plannedQuantity !== undefined) order.plannedQuantity = parsed.plannedQuantity
    if (parsed.producedQuantity !== undefined) order.producedQuantity = parsed.producedQuantity
    if (parsed.rejectedQuantity !== undefined) order.rejectedQuantity = parsed.rejectedQuantity
    if (parsed.plannedStartDate !== undefined) order.plannedStartDate = parsed.plannedStartDate
    if (parsed.plannedEndDate !== undefined) order.plannedEndDate = parsed.plannedEndDate
    if (parsed.actualStartDate !== undefined) order.actualStartDate = parsed.actualStartDate
    if (parsed.actualEndDate !== undefined) order.actualEndDate = parsed.actualEndDate
    if (parsed.warehouseId !== undefined) order.warehouseId = parsed.warehouseId
    if (parsed.notes !== undefined) order.notes = parsed.notes

    if (parsed.status && parsed.status !== previousStatus) {
      if (parsed.status === 'in_progress' && !order.actualStartDate) {
        order.actualStartDate = new Date()
      }
      if (parsed.status === 'completed' && !order.actualEndDate) {
        order.actualEndDate = new Date()
      }
    }

    await em.flush()

    if (parsed.status && parsed.status !== previousStatus) {
      const eventPayload = {
        id: order.id,
        orderNumber: order.orderNumber,
        productName: order.productName,
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
      }

      if (parsed.status === 'in_progress') {
        void emitManufacturingEvent('manufacturing.production_order.started', eventPayload)
      } else if (parsed.status === 'completed') {
        void emitManufacturingEvent('manufacturing.production_order.completed', eventPayload)
      } else if (parsed.status === 'cancelled') {
        void emitManufacturingEvent('manufacturing.production_order.cancelled', eventPayload)
      }
    }

    return { ok: true }
  },
})

registerCommand({
  id: 'manufacturing.production_order.delete',
  features: ['manufacturing.production_orders.manage'],
  execute: async (payload, ctx) => {
    const parsed = deleteProductionOrderSchema.parse(payload)
    ensureTenantScope(ctx, parsed.tenantId)
    const em = resolveEm(ctx)
    const order = await em.findOneOrFail(ProductionOrder, { id: parsed.id, organizationId: parsed.organizationId, deletedAt: null })
    if (order.status === 'in_progress') throw new CrudHttpError(400, { error: 'Cannot delete an in-progress production order.' })
    order.deletedAt = new Date()
    await em.flush()
    return { ok: true }
  },
})
