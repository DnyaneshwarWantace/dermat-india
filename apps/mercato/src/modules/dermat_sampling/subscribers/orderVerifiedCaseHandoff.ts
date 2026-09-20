import type { EntityManager } from '@mikro-orm/postgresql'
import type { AwilixContainer } from 'awilix'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { Sample } from '../data/entities'

export const metadata = {
  event: 'dermat_sales_flow.order.verified',
  persistent: true,
  id: 'dermat_sampling:order-verified-case-handoff',
}

type OrderVerifiedPayload = {
  orderId?: string
  organizationId?: string
  tenantId?: string
  verifiedBy?: string | null
}

type SubscriberContext = {
  resolve: <T = unknown>(name: string) => T
}

type OrderRow = {
  id: string
  order_number: string | null
}

type OrderLineRow = {
  name: string | null
}

/**
 * R&D auto-handoff (spec correction, narrowed scope): the Order Kanban's stage-gate command
 * (dermat_sales_flow.orders.transition_stage) emits `dermat_sales_flow.order.verified` when an
 * order moves New -> Verified/Official. This subscriber creates the corresponding R&D case
 * automatically so the R&D queue is populated with zero manual re-entry.
 *
 * This is a single-source-of-truth record: the `Sample` row created here is the SAME record
 * read/written by both the compact R&D panel embedded on the Order detail page and (later) the
 * dedicated dermat_sampling R&D page — there is no separate/duplicate status field per surface.
 *
 * Cross-module boundary: no ORM relation to `sales_orders` (banned) — a plain SQL read against
 * the owning module's table for a denormalized product-name label only, same idiom used by
 * `dermat_sales_flow`'s own stock-check route and `dealAdvanceReceivedConversion` subscriber.
 */
export default async function handle(payload: OrderVerifiedPayload, ctx: SubscriberContext): Promise<void> {
  const orderId = payload.orderId
  const organizationId = payload.organizationId
  const tenantId = payload.tenantId
  if (!orderId || !organizationId || !tenantId) return

  const em = ctx.resolve<EntityManager>('em').fork()

  const existing = await em.findOne(Sample, {
    orderId,
    organizationId,
    tenantId,
    deletedAt: null,
  })
  if (existing) return

  const orderRows = await em.getConnection().execute<OrderRow[]>(
    `select id, order_number from sales_orders
     where id = ? and organization_id = ? and tenant_id = ? and deleted_at is null`,
    [orderId, organizationId, tenantId],
  )
  const order = orderRows[0]
  if (!order) return

  const lineRows = await em.getConnection().execute<OrderLineRow[]>(
    `select name from sales_order_lines
     where order_id = ? and organization_id = ? and tenant_id = ? and deleted_at is null
     order by line_number asc limit 1`,
    [orderId, organizationId, tenantId],
  )
  const productName = lineRows[0]?.name ?? order.order_number ?? 'Order formulation'

  const commandBus = ctx.resolve<CommandBus>('commandBus')
  await commandBus.execute<Record<string, unknown>, { sampleId: string }>(
    'dermat_sampling.samples.create',
    {
      input: {
        organizationId,
        tenantId,
        orderId,
        productName,
        rndStage: 'pending',
        sourceOrderVerifiedBy: payload.verifiedBy ?? null,
        requestedBy: payload.verifiedBy ?? null,
        notes: `Auto-created on order verification (${order.order_number ?? orderId}).`,
      },
      ctx: {
        container: { resolve: ctx.resolve } as never,
        auth: { sub: '00000000-0000-0000-0000-000000000000', tenantId, orgId: organizationId },
        organizationScope: null,
        selectedOrganizationId: organizationId,
        organizationIds: [organizationId],
        systemActor: true,
      },
    },
  )
}
