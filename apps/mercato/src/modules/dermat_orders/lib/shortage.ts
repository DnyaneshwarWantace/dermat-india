import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { currentBomFor, explodeBom } from '../../dermat_boms/lib/explode'
import type { BomRequestContext } from '../../dermat_boms/lib/server'
import { DermatOrder, DermatOrderLine } from '../data/entities'
import { logEvent } from './engine'
import type { OrderContext } from './server'

const logger = createLogger('dermat_orders')

export type Shortage = { productId: string; name: string; code: string | null; unit: string | null; needed: number; onHand: number; short: number }

export async function orderShortages(ctx: OrderContext, order: DermatOrder): Promise<{ shortages: Shortage[]; withoutBom: number }> {
  const bomCtx = ctx as unknown as BomRequestContext
  const lines = await ctx.em.find(DermatOrderLine, { orderId: order.id })
  const totals = new Map<string, Shortage>()
  let withoutBom = 0
  for (const line of lines) {
    const header = await currentBomFor(bomCtx, line.productId, order.id)
    if (!header) {
      withoutBom += 1
      continue
    }
    const { requirements } = await explodeBom(bomCtx, header, Number(line.quantity), order.id)
    for (const row of requirements) {
      const current = totals.get(row.productId)
      const needed = (current?.needed ?? 0) + row.quantity
      totals.set(row.productId, { productId: row.productId, name: row.name, code: row.code, unit: row.unit, needed, onHand: row.onHand, short: Math.max(0, needed - row.onHand) })
    }
  }
  return { shortages: Array.from(totals.values()).filter((row) => row.short > 0.0005), withoutBom }
}

function qty(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(value)
}

export async function warnShortagesAtBooking(ctx: OrderContext, order: DermatOrder, byName: string | null): Promise<number> {
  try {
    const { shortages } = await orderShortages(ctx, order)
    if (!shortages.length) return 0
    const text = shortages.slice(0, 8).map((row) => `${row.code ? `${row.code} ` : ''}${row.name} short ${qty(row.short)} ${row.unit ?? ''}`.trim()).join('; ')
    logEvent(ctx, order, 'shortage', 'planning', `Short at booking: ${text}${shortages.length > 8 ? ` and ${shortages.length - 8} more` : ''}`, byName)
    await ctx.em.flush()
    await resolveNotificationService(ctx.container as unknown as { resolve: (name: string) => unknown }).createForFeature(
      {
        type: 'dermat_orders.order.shortage',
        requiredFeature: 'dermat_planning.reserve',
        title: `${order.orderNo}: ${shortages.length} material(s) short`,
        body: text,
        severity: 'warning',
        sourceModule: 'dermat_orders',
        sourceEntityType: 'dermat_orders:order',
        sourceEntityId: order.id,
        linkHref: `/backend/orders/${order.id}?tab=materials`,
        groupKey: `dermat_orders:${order.id}:shortage`,
      },
      { tenantId: ctx.tenantId, organizationId: ctx.organizationId },
    )
    return shortages.length
  } catch (error) {
    logger.error('Failed to check shortages at booking', { err: error })
    return 0
  }
}
