import type { QueryEngine } from '@wantace/shared/lib/query/types'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../../manufacturing/notifications'
import { createLogger } from '@wantace/shared/lib/logger'

const logger = createLogger('purchasing')

export const metadata = {
  event: 'purchasing.purchase_order.sent',
  persistent: true,
  id: 'purchasing:purchase-order-sent-notify-production',
}

type PurchaseOrderSentPayload = {
  id?: string | null
  orderNumber?: string | null
  supplierName?: string | null
  tenantId?: string | null
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: PurchaseOrderSentPayload, ctx: ResolverContext) {
  try {
    if (!payload.tenantId) return

    const queryEngine = ctx.resolve<QueryEngine>('queryEngine')

    const poResult = await queryEngine.query('manufacturing:production_order' as never, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? undefined,
      filters: { status: { $in: ['draft', 'planned'] } },
      fields: ['id', 'order_number', 'product_name'],
      page: { page: 1, pageSize: 5 },
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
          supplierName: payload.supplierName ?? '',
        },
        sourceEntityType: 'purchasing:purchase_order',
        sourceEntityId: payload.id ?? '',
        linkHref: `/backend/manufacturing/production-orders/${encodeURIComponent(order.id)}`,
      })

      await notificationService.createForFeature(notificationInput, {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId ?? null,
      })
    }
  } catch (error) {
    logger.error('Failed to notify production about purchase order sent', {
      subscriber: 'purchase-order-sent-notify-production',
      err: error,
    })
  }
}
