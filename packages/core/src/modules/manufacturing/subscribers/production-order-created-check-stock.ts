import type { QueryEngine } from '@wantace/shared/lib/query/types'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { createLogger } from '@wantace/shared/lib/logger'

const logger = createLogger('manufacturing')

export const metadata = {
  event: 'manufacturing.production_order.created',
  persistent: true,
  id: 'manufacturing:production-order-created-check-stock',
}

type ProductionOrderCreatedPayload = {
  id?: string | null
  bomId?: string | null
  orderNumber?: string | null
  productName?: string | null
  plannedQuantity?: number | null
  tenantId?: string | null
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

type BomLine = {
  product_variant_id: string
  product_name: string
  quantity: string | number
}

type InventoryBalance = {
  available_quantity?: string | number | null
}

export default async function handle(payload: ProductionOrderCreatedPayload, ctx: ResolverContext) {
  try {
    if (!payload.id || !payload.bomId || !payload.tenantId) return

    const queryEngine = ctx.resolve<QueryEngine>('queryEngine')

    const bomLinesResult = await queryEngine.query('manufacturing:bom_line' as never, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? undefined,
      filters: { bom_id: { $eq: payload.bomId } },
      fields: ['id', 'product_variant_id', 'product_name', 'quantity'],
      page: { page: 1, pageSize: 100 },
    })

    const bomLines = (bomLinesResult.items ?? []) as BomLine[]
    if (!bomLines.length) return

    const shortfalls: Array<{ name: string; required: number; available: number; short: number }> = []

    for (const line of bomLines) {
      const requiredQty = Number(line.quantity) * (Number(payload.plannedQuantity) || 1)

      let availableQty = 0
      try {
        const invResult = await queryEngine.query('wms:inventory_balance' as never, {
          tenantId: payload.tenantId,
          organizationId: payload.organizationId ?? undefined,
          filters: { product_variant_id: { $eq: line.product_variant_id } },
          fields: ['id', 'available_quantity'],
          page: { page: 1, pageSize: 1 },
        })
        const inv = (invResult.items?.[0] as InventoryBalance | undefined)
        availableQty = Number(inv?.available_quantity ?? 0)
      } catch {
        // WMS module may not exist — treat as 0 stock
      }

      if (availableQty < requiredQty) {
        shortfalls.push({
          name: line.product_name || line.product_variant_id,
          required: requiredQty,
          available: availableQty,
          short: requiredQty - availableQty,
        })
      }
    }

    if (!shortfalls.length) return

    const notificationService = resolveNotificationService(ctx)
    const typeDef = notificationTypes.find((t) => t.type === 'manufacturing.production_order.materials_short')
    if (!typeDef) return

    const primaryShortfall = shortfalls[0]

    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'wms.view',
      bodyVariables: {
        orderNumber: payload.orderNumber ?? payload.id,
        shortfallCount: String(shortfalls.length),
        shortfallItem: primaryShortfall.name,
        shortfallQuantity: String(primaryShortfall.short),
      },
      sourceEntityType: 'manufacturing:production_order',
      sourceEntityId: payload.id,
      linkHref: `/backend/manufacturing/production-orders/${encodeURIComponent(payload.id)}`,
    })

    await notificationService.createForFeature(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (error) {
    logger.error('Failed to check stock for production order', {
      subscriber: 'production-order-created-check-stock',
      err: error,
    })
  }
}
