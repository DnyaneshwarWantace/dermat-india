import type { QueryEngine } from '@wantace/shared/lib/query/types'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { createLogger } from '@wantace/shared/lib/logger'

const logger = createLogger('manufacturing')

export const metadata = {
  event: 'sales.order.confirmed',
  persistent: true,
  id: 'manufacturing:sales-order-confirmed-notify-production',
}

type SalesOrderConfirmedPayload = {
  orderId?: string | null
  tenantId?: string | null
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: SalesOrderConfirmedPayload, ctx: ResolverContext) {
  try {
    if (!payload.orderId || !payload.tenantId) return

    const notificationService = resolveNotificationService(ctx)
    const typeDef = notificationTypes.find((t) => t.type === 'manufacturing.production_order.new_order')
    if (!typeDef) return

    let orderNumber = payload.orderId
    let productName = ''

    try {
      const queryEngine = ctx.resolve<QueryEngine>('queryEngine')
      const result = await queryEngine.query('sales:sales_order' as never, {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId ?? undefined,
        filters: { id: { $eq: payload.orderId } },
        fields: ['id', 'order_number', 'metadata'],
        page: { page: 1, pageSize: 1 },
      })
      const row = result.items?.[0] as { order_number?: string; metadata?: unknown } | undefined
      if (row?.order_number) orderNumber = row.order_number
    } catch {
      // fall through with orderId as orderNumber
    }

    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'manufacturing.production_orders.manage',
      bodyVariables: {
        orderNumber,
        productName: productName || 'items in this order',
      },
      sourceEntityType: 'sales:order',
      sourceEntityId: payload.orderId,
      linkHref: `/backend/sales/orders/${encodeURIComponent(payload.orderId)}`,
    })

    await notificationService.createForFeature(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (error) {
    logger.error('Failed to notify production team about confirmed sales order', {
      subscriber: 'sales-order-confirmed-notify-production',
      err: error,
    })
  }
}
