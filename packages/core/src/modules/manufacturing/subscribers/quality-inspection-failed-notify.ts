import type { QueryEngine } from '@wantace/shared/lib/query/types'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { createLogger } from '@wantace/shared/lib/logger'

const logger = createLogger('manufacturing')

export const metadata = {
  event: 'manufacturing.quality_inspection.failed',
  persistent: true,
  id: 'manufacturing:quality-inspection-failed-notify',
}

type QualityInspectionPayload = {
  id?: string | null
  productionOrderId?: string | null
  productName?: string | null
  failedQuantity?: number | null
  tenantId?: string | null
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: QualityInspectionPayload, ctx: ResolverContext) {
  try {
    if (!payload.productionOrderId || !payload.tenantId) return

    const notificationService = resolveNotificationService(ctx)
    const typeDef = notificationTypes.find((t) => t.type === 'manufacturing.quality_inspection.failed')
    if (!typeDef) return

    let orderNumber = payload.productionOrderId
    try {
      const queryEngine = ctx.resolve<QueryEngine>('queryEngine')
      const result = await queryEngine.query('manufacturing:production_order' as never, {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId ?? undefined,
        filters: { id: { $eq: payload.productionOrderId } },
        fields: ['id', 'order_number'],
        page: { page: 1, pageSize: 1 },
      })
      const row = result.items?.[0] as { order_number?: string } | undefined
      if (row?.order_number) orderNumber = row.order_number
    } catch {
      // fall through
    }

    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'manufacturing.production_orders.manage',
      bodyVariables: {
        orderNumber,
        productName: payload.productName ?? '',
        failedQuantity: String(payload.failedQuantity ?? 0),
      },
      sourceEntityType: 'manufacturing:production_order',
      sourceEntityId: payload.productionOrderId,
      linkHref: `/backend/manufacturing/production-orders/${encodeURIComponent(payload.productionOrderId)}`,
    })

    await notificationService.createForFeature(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (error) {
    logger.error('Failed to notify about QC failure', {
      subscriber: 'quality-inspection-failed-notify',
      err: error,
    })
  }
}
