import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { createLogger } from '@open-mercato/shared/lib/logger'
import type { OrderContext } from '../../dermat_orders/lib/server'
import type { RdRequest, RdTrial } from '../data/entities'

const logger = createLogger('dermat_rnd')

export async function notifyStabilityFailedAfterApproval(ctx: OrderContext, request: RdRequest, trial: RdTrial, reason: string | null) {
  const service = resolveNotificationService(ctx.container as unknown as { resolve: (name: string) => unknown })
  const title = `${trial.code}: stability failed after approval`
  const body = [request.productName, request.customerName, request.orderNo, reason].filter(Boolean).join(' · ')
  const targets = [
    { requiredFeature: 'dermat_rnd.manage', linkHref: `/backend/rnd/requests/${request.id}` },
    { requiredFeature: 'dermat_rnd.request', linkHref: `/backend/sales/samples/${request.id}` },
  ]
  for (const target of targets) {
    try {
      await service.createForFeature(
        {
          type: 'dermat_rnd.stability.failed',
          requiredFeature: target.requiredFeature,
          title,
          body,
          severity: 'warning',
          sourceModule: 'dermat_rnd',
          sourceEntityType: 'dermat_rnd:request',
          sourceEntityId: request.id,
          linkHref: target.linkHref,
          groupKey: `dermat_rnd:${trial.id}:stability_failed:${target.requiredFeature}`,
        },
        { tenantId: ctx.tenantId, organizationId: ctx.organizationId },
      )
    } catch (error) {
      logger.error('Failed to send the stability alert', { err: error })
    }
  }
}
