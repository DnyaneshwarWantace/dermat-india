import type { QueryEngine } from '@wantace/shared/lib/query/types'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { createLogger } from '@wantace/shared/lib/logger'

const logger = createLogger('manufacturing')

export const metadata = {
  event: 'manufacturing.production_stage.completed',
  persistent: true,
  id: 'manufacturing:production-stage-completed-notify-next',
}

type StageCompletedPayload = {
  id?: string | null
  productionOrderId?: string | null
  sequenceNumber?: number | null
  name?: string | null
  tenantId?: string | null
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

type ProductionStage = {
  id: string
  sequence_number: number
  name: string
  status: string
}

export default async function handle(payload: StageCompletedPayload, ctx: ResolverContext) {
  try {
    if (!payload.productionOrderId || !payload.tenantId) return

    const queryEngine = ctx.resolve<QueryEngine>('queryEngine')

    const stagesResult = await queryEngine.query('manufacturing:production_stage' as never, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? undefined,
      filters: { production_order_id: { $eq: payload.productionOrderId } },
      fields: ['id', 'sequence_number', 'name', 'status'],
      page: { page: 1, pageSize: 100 },
      sort: { sequence_number: 'asc' },
    })

    const stages = (stagesResult.items ?? []) as ProductionStage[]
    const allDone = stages.every((s) => s.status === 'completed' || s.status === 'skipped')

    let orderNumber = payload.productionOrderId
    try {
      const poResult = await queryEngine.query('manufacturing:production_order' as never, {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId ?? undefined,
        filters: { id: { $eq: payload.productionOrderId } },
        fields: ['id', 'order_number', 'product_name'],
        page: { page: 1, pageSize: 1 },
      })
      const po = poResult.items?.[0] as { order_number?: string; product_name?: string } | undefined
      if (po?.order_number) orderNumber = po.order_number
    } catch {
      // fall through
    }

    const notificationService = resolveNotificationService(ctx)

    if (allDone) {
      const typeDef = notificationTypes.find((t) => t.type === 'manufacturing.production_order.production_completed')
      if (!typeDef) return

      const poResult = await queryEngine.query('manufacturing:production_order' as never, {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId ?? undefined,
        filters: { id: { $eq: payload.productionOrderId } },
        fields: ['id', 'product_name'],
        page: { page: 1, pageSize: 1 },
      })
      const productName = (poResult.items?.[0] as { product_name?: string } | undefined)?.product_name ?? ''

      const notificationInput = buildFeatureNotificationFromType(typeDef, {
        requiredFeature: 'manufacturing.quality_inspections.manage',
        bodyVariables: {
          orderNumber,
          productName,
        },
        sourceEntityType: 'manufacturing:production_order',
        sourceEntityId: payload.productionOrderId,
        linkHref: `/backend/manufacturing/production-orders/${encodeURIComponent(payload.productionOrderId)}`,
      })

      await notificationService.createForFeature(notificationInput, {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId ?? null,
      })
    } else {
      const typeDef = notificationTypes.find((t) => t.type === 'manufacturing.production_order.stage_completed')
      if (!typeDef) return

      const nextStage = stages.find((s) => s.status === 'pending')
      const nextAction = nextStage ? `Next stage: "${nextStage.name}"` : 'Check remaining stages.'

      const notificationInput = buildFeatureNotificationFromType(typeDef, {
        requiredFeature: 'manufacturing.production_stages.manage',
        bodyVariables: {
          stageName: payload.name ?? 'Stage',
          orderNumber,
          nextAction,
        },
        sourceEntityType: 'manufacturing:production_order',
        sourceEntityId: payload.productionOrderId,
        linkHref: `/backend/manufacturing/production-orders/${encodeURIComponent(payload.productionOrderId)}`,
      })

      await notificationService.createForFeature(notificationInput, {
        tenantId: payload.tenantId,
        organizationId: payload.organizationId ?? null,
      })
    }
  } catch (error) {
    logger.error('Failed to notify about stage completion', {
      subscriber: 'production-stage-completed-notify-next',
      err: error,
    })
  }
}
