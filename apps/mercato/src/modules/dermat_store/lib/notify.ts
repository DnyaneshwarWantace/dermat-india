import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { stageDef, stageWorkFeatures } from '../../dermat_orders/lib/stages'
import type { StoreRequest } from '../data/entities'
import type { StoreContext } from './server'

const logger = createLogger('dermat_store')

async function send(ctx: StoreContext, payload: { type: string; requiredFeature: string; title: string; body: string; request: StoreRequest }) {
  try {
    await resolveNotificationService(ctx.container as unknown as { resolve: (name: string) => unknown }).createForFeature(
      {
        type: payload.type,
        requiredFeature: payload.requiredFeature,
        title: payload.title,
        body: payload.body,
        severity: 'info',
        sourceModule: 'dermat_store',
        sourceEntityType: 'dermat_store:request',
        sourceEntityId: payload.request.id,
        linkHref: `/backend/store/requests/${payload.request.id}`,
        groupKey: `dermat_store:${payload.request.id}:${payload.type}`,
      },
      { tenantId: ctx.tenantId, organizationId: ctx.organizationId },
    )
  } catch (error) {
    logger.error('Failed to send a store notification', { err: error })
  }
}

export async function notifyRequested(ctx: StoreContext, requests: StoreRequest[]) {
  for (const request of requests) {
    const stage = stageDef(request.stageKey)?.label ?? request.stageKey
    await send(ctx, {
      type: 'dermat_store.request.created',
      requiredFeature: 'dermat_store.issue',
      title: `${request.code}: ${request.store === 'rm' ? 'RM' : 'PM'} needed for ${request.orderNo}`,
      body: [stage, request.requestedByName ? `Asked by ${request.requestedByName}` : null, request.notes].filter(Boolean).join(' · '),
      request,
    })
  }
}

export async function notifyIssued(ctx: StoreContext, request: StoreRequest, byName: string | null) {
  const stage = stageDef(request.stageKey)?.label ?? request.stageKey
  for (const requiredFeature of stageWorkFeatures(request.stageKey)) await send(ctx, {
    type: 'dermat_store.request.issued',
    requiredFeature,
    title: `${request.code}: material issued for ${request.orderNo} — count and confirm`,
    body: [stage, byName ? `Issued by ${byName}` : null].filter(Boolean).join(' · '),
    request,
  })
}
