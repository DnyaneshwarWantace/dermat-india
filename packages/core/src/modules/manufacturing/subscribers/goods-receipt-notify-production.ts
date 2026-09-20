import type { QueryEngine } from '@wantace/shared/lib/query/types'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { createLogger } from '@wantace/shared/lib/logger'

const logger = createLogger('manufacturing')

export const metadata = {
  event: 'purchasing.goods_receipt.completed',
  persistent: true,
  id: 'manufacturing:goods-receipt-notify-production',
}

type GoodsReceiptPayload = {
  id?: string | null
  purchaseOrderId?: string | null
  tenantId?: string | null
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: GoodsReceiptPayload, ctx: ResolverContext) {
  try {
    if (!payload.tenantId) return

    const queryEngine = ctx.resolve<QueryEngine>('queryEngine')

    const poResult = await queryEngine.query('manufacturing:production_order' as never, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? undefined,
      filters: { status: { $in: ['draft', 'planned'] } },
      fields: ['id', 'order_number', 'product_name', 'status'],
      page: { page: 1, pageSize: 10 },
    })

    const pendingOrders = (poResult.items ?? []) as Array<{ id: string; order_number: string; product_name: string }>
    if (!pendingOrders.length) return

    const notificationService = resolveNotificationService(ctx)
    const typeDef = notificationTypes.find((t) => t.type === 'manufacturing.production_order.materials_ready')
    if (!typeDef) return

    for (const order of pendingOrders) {
      const notificationInput = buildFeatureNotificationFromType(typeDef, {
        requiredFeature: 'manufacturing.production_orders.manage',
        bodyVariables: {
          orderNumber: order.order_number,
        },
        sourceEntityType: 'manufacturing:production_order',
        sourceEntityId: order.id,
        linkHref: `/backend/manufacturing/production-orders/${encodeURIComponent(order.id)}`,
      })

      await notificationService.createForFeature(notificationInput, {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId ?? null,
      })
    }
  } catch (error) {
    logger.error('Failed to notify production about goods receipt', {
      subscriber: 'goods-receipt-notify-production',
      err: error,
    })
  }
}
