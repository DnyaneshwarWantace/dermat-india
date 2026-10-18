import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { stageActionSchema } from '../../../data/validators'
import { DermatOrderStage } from '../../../data/entities'
import { applyStageAction, serializeOrder } from '../../../lib/engine'
import { currentUserName, findOrder, hasFeatures, resolveOrderContext } from '../../../lib/server'
import { notifyAssigned, notifyCardAssigned, notifyStagesOpened, notifyStagesPaused } from '../../../lib/notify'
import { cardPeople } from '../../../lib/tasks'
import { canSeeMoney } from '../../../lib/money'
import { OWNER_NAMES, STOCK_STAGES, stageDef, stageWorkFeature, stepOwners } from '../../../lib/stages'
import { effectiveStageDef, loadStageOverrides } from '../../../lib/stageSettings'
import { enforceOrderLock, orderErrorResponse, runGuarded } from '../../../lib/guard'
import { STORE_STAGE_KEYS, consumeForStage, type StoreStage } from '../../../../dermat_store/lib/service'
import { resolveStoreContext } from '../../../../dermat_store/lib/server'
import { releaseAllForOrder } from '../../../../dermat_planning/lib/service'
import { onProductionStageDone } from '../../../lib/productionStock'
import { withStageOverrides } from '../../../lib/stageSettings'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['dermat_orders.stages'] },
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  return withStageOverrides(ctx, async () => {
    const parsed = stageActionSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid stage action', details: parsed.error.flatten() }, { status: 400 })
    const money = await canSeeMoney(ctx)
    const reopenAnyTime = parsed.data.action === 'revert' && (await hasFeatures(ctx, ['dermat_orders.reopen']))
    const cardKey = parsed.data.action === 'step' || parsed.data.action === 'save' ? parsed.data.stepKey : parsed.data.action === 'checklist' ? 'qa_final' : parsed.data.action === 'pm_status' ? 'pm_ok' : parsed.data.action === 'delivered' ? 'delivered' : undefined
    const effective = effectiveStageDef(parsed.data.stageKey, await loadStageOverrides(ctx))
    const card = cardKey ? effective?.steps.find((step) => step.key === cardKey) : undefined
    const cardOwners = card ? stepOwners(parsed.data.stageKey, card) : []
    let ownsCard = false
    for (const feature of cardOwners) if (!ownsCard && (await hasFeatures(ctx, [feature]))) ownsCard = true
    if (parsed.data.action === 'pm_status' && !ownsCard && effective?.steps.some((step) => step.key === 'pm_ordered')) {
      for (const feature of stepOwners(parsed.data.stageKey, { key: 'pm_ordered' })) if (!ownsCard && (await hasFeatures(ctx, [feature]))) ownsCard = true
    }
    const cardAction = Boolean(card) && (parsed.data.action === 'step' || parsed.data.action === 'checklist' || (parsed.data.action === 'save' && Boolean(parsed.data.stepKey)))
    const onBehalf = cardAction && !ownsCard && (await hasFeatures(ctx, ['dermat_orders.settings']))
    if (onBehalf && card) parsed.data.note = `Done on behalf of ${cardOwners.map((feature) => OWNER_NAMES[feature] ?? feature).join(' / ')}`
    const allowed = cardAction
      ? ownsCard || onBehalf
      : reopenAnyTime ||
        ownsCard ||
        (await hasFeatures(ctx, [stageWorkFeature(parsed.data.stageKey)])) ||
        (parsed.data.action === 'assign' && (await hasFeatures(ctx, ['dermat_orders.manage'])))
    if (!allowed && cardAction && card) {
      return NextResponse.json({ error: `${card.label} is done by ${cardOwners.map((feature) => OWNER_NAMES[feature] ?? feature).join(' or ')}` }, { status: 403 })
    }
    if (!allowed) {
      const def = stageDef(parsed.data.stageKey)
      return NextResponse.json({ error: `Only the ${def?.department ?? 'responsible'} department can work on ${def?.label ?? 'this stage'}` }, { status: 403 })
    }
    try {
      const order = await findOrder(ctx, parsed.data.orderId)
      const before = await ctx.em.fork().find(DermatOrderStage, { orderId: order.id })
      const statusBefore = new Map(before.map((stage) => [stage.stageKey, stage.status]))
      const stockPostedBefore = new Set(before.filter((stage) => (stage.data as Record<string, unknown> | null)?.__stock_posted).map((stage) => stage.stageKey))
      let paused: string[] = []
      if (parsed.data.action !== 'assign' && parsed.data.action !== 'save') enforceOrderLock(order, req)
      return await runGuarded(ctx, req, { resourceId: order.id, operation: 'custom', payload: parsed.data }, async () => {
        await ctx.em.transactional(async (em) => {
          const txCtx = { ...ctx, em: em as EntityManager }
          const fresh = await findOrder(txCtx, order.id)
          paused = await applyStageAction(txCtx, fresh, parsed.data, { reopenAnyTime, money })
          if (fresh.status === 'completed') await releaseAllForOrder(txCtx, fresh.id, 'Order completed', null)
          await em.flush()
        })
        const statusNow = (await ctx.em.fork().findOne(DermatOrderStage, { orderId: order.id, stageKey: parsed.data.stageKey }))?.status
        const finishedNow = statusNow === 'done' && statusBefore.get(parsed.data.stageKey) !== 'done'
        if (finishedNow && STORE_STAGE_KEYS.includes(parsed.data.stageKey as StoreStage)) {
          const storeCtx = await resolveStoreContext(req)
          if (!('error' in storeCtx)) {
            const stage = await ctx.em.fork().findOne(DermatOrderStage, { orderId: order.id, stageKey: parsed.data.stageKey })
            const saved = stage?.data?.batch_no ?? (await ctx.em.fork().findOne(DermatOrderStage, { orderId: order.id, stageKey: 'manufacturing' }))?.data?.batch_no
            const batchNo = typeof saved === 'string' || typeof saved === 'number' ? String(saved) : null
            await consumeForStage(storeCtx, order.id, parsed.data.stageKey, batchNo)
          }
        }
        if (parsed.data.action === 'reject_batch') {
          const storeCtx = await resolveStoreContext(req)
          if (!('error' in storeCtx)) {
            const stage = await ctx.em.fork().findOne(DermatOrderStage, { orderId: order.id, stageKey: parsed.data.stageKey })
            const rounds = Array.isArray(stage?.data?.__rework) ? (stage?.data?.__rework as Array<{ batchNo?: string | null }>) : []
            await consumeForStage(storeCtx, order.id, parsed.data.stageKey, rounds[rounds.length - 1]?.batchNo ?? null, parsed.data.note ?? 'Rejected by QC')
          }
        }
        if (finishedNow && STOCK_STAGES.includes(parsed.data.stageKey) && !stockPostedBefore.has(parsed.data.stageKey)) {
          const stockCtx = await resolveStoreContext(req)
          if (!('error' in stockCtx)) await onProductionStageDone(stockCtx, order.id, parsed.data.stageKey)
        }
        const freshCtx = { ...ctx, em: ctx.em.fork() }
        const freshOrder = await findOrder(freshCtx, order.id)
        const after = await freshCtx.em.find(DermatOrderStage, { orderId: order.id })
        const opened = after.filter((stage) => stage.status === 'open' && statusBefore.get(stage.stageKey) !== 'open' && statusBefore.get(stage.stageKey) !== 'on_hold').map((stage) => stage.stageKey)
        await notifyStagesOpened(ctx, freshOrder, opened)
        const actor = await currentUserName(ctx)
        for (const stage of after) {
          const was = cardPeople(before.find((entry) => entry.stageKey === stage.stageKey)?.data as Record<string, unknown> | null)
          const def = stageDef(stage.stageKey)
          for (const [cardKey, person] of Object.entries(cardPeople(stage.data as Record<string, unknown> | null))) {
            if (person.userId === was[cardKey]?.userId || person.userId === ctx.userId) continue
            await notifyCardAssigned(ctx, freshOrder, stage.stageKey, def?.steps.find((step) => step.key === cardKey)?.label ?? cardKey, person.userId, actor)
          }
        }
        if (parsed.data.action === 'revert') await notifyStagesPaused(ctx, freshOrder, parsed.data.stageKey, paused, parsed.data.note ?? '', await currentUserName(ctx))
        if (parsed.data.action === 'assign' && parsed.data.responsibleUserId && parsed.data.responsibleUserId !== ctx.userId) {
          await notifyAssigned(ctx, freshOrder, parsed.data.stageKey, parsed.data.responsibleUserId, await currentUserName(ctx))
        }
        return NextResponse.json(await serializeOrder(freshCtx, freshOrder))
      })
    } catch (error) {
      return orderErrorResponse(error)
    }
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Work on an order stage',
  methods: {
    POST: {
      summary: 'Save, complete, hold, resume, reopen, skip or assign an order stage',
      tags: ['Dermat Orders'],
      requestBody: { schema: stageActionSchema },
      responses: [{ status: 200, description: 'The updated order', schema: z.object({ id: z.string() }).passthrough() }],
      errors: [
        { status: 400, description: 'Required fields missing or BOM not approved' },
        { status: 409, description: 'Stage not in the right state, or the order changed' },
      ],
    },
  },
}

export { POST }
