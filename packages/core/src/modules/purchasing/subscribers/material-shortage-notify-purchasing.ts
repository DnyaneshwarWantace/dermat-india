import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../../manufacturing/notifications'
import { createLogger } from '@wantace/shared/lib/logger'

const logger = createLogger('purchasing')

export const metadata = {
  event: 'manufacturing.production_order.created',
  persistent: true,
  id: 'purchasing:material-shortage-notify-purchasing',
}

type ProductionOrderCreatedPayload = {
  id?: string | null
  orderNumber?: string | null
  productName?: string | null
  bomId?: string | null
  tenantId?: string | null
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: ProductionOrderCreatedPayload, ctx: ResolverContext) {
  try {
    if (!payload.tenantId || !payload.bomId) return

    const notificationService = resolveNotificationService(ctx)
    const typeDef = notificationTypes.find((t) => t.type === 'manufacturing.production_order.materials_short')
    if (!typeDef) return

    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'purchasing.purchase_orders.manage',
      bodyVariables: {
        orderNumber: payload.orderNumber ?? 'N/A',
        productName: payload.productName ?? '',
      },
      sourceEntityType: 'manufacturing:production_order',
      sourceEntityId: payload.id ?? '',
      linkHref: `/backend/manufacturing/production-orders/${encodeURIComponent(payload.id ?? '')}`,
    })

    await notificationService.createForFeature(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (error) {
    logger.error('Failed to notify purchasing about material needs', {
      subscriber: 'material-shortage-notify-purchasing',
      err: error,
    })
  }
}
