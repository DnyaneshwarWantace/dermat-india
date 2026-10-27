import { createLogger } from '@open-mercato/shared/lib/logger'
import { DermatOrder, DermatOrderLine, DermatOrderStage } from '../data/entities'
import { applyStageAction } from './engine'
import { OrderError, type OrderContext } from './server'
import { stepStates } from './stages'

const logger = createLogger('dermat_orders').child({ component: 'auto-steps' })

export async function tickStep(base: OrderContext, orderId: string, stageKey: string, stepKey: string): Promise<boolean> {
  const ctx = { ...base, em: base.em.fork() }
  const order = await ctx.em.findOne(DermatOrder, { id: orderId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null })
  if (!order || order.status === 'cancelled' || order.status === 'completed') return false
  const stage = await ctx.em.findOne(DermatOrderStage, { orderId, stageKey })
  if (!stage || (stage.status !== 'open' && stage.status !== 'on_hold')) return false
  if (stepStates(stage.data)[stepKey]?.done) return false
  try {
    await applyStageAction(ctx, order, { stageKey, action: 'step', stepKey, done: true } as Parameters<typeof applyStageAction>[2])
    order.updatedAt = new Date()
    await ctx.em.flush()
    return true
  } catch (error) {
    if (!(error instanceof OrderError)) logger.error('Automatic step failed', { orderId, stageKey, stepKey, err: error })
    return false
  }
}

export async function tickStoreAsked(ctx: OrderContext, requests: Array<{ orderId: string; stageKey: string }>): Promise<void> {
  const seen = new Set<string>()
  for (const request of requests) {
    if (request.stageKey !== 'filling' && request.stageKey !== 'packing') continue
    const key = `${request.orderId}:${request.stageKey}`
    if (seen.has(key)) continue
    seen.add(key)
    await tickStep(ctx, request.orderId, request.stageKey, 'pm_asked')
  }
}

export async function syncFormulationSteps(ctx: OrderContext, productId: string, orderId: string | null = null): Promise<void> {
  const lines = await ctx.em.find(DermatOrderLine, orderId ? { orderId } : { productId })
  const orderIds = Array.from(new Set(lines.map((line) => line.orderId)))
  for (const id of orderIds) {
    await tickStep(ctx, id, 'formulation', 'bom_made')
    await tickStep(ctx, id, 'formulation', 'bom_approved')
  }
}
