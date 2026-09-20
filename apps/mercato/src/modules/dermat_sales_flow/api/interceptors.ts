import type { ApiInterceptor } from '@open-mercato/shared/lib/crud/api-interceptor'
import { SalesOrderLine } from '@open-mercato/core/modules/sales/data/entities'

/**
 * Production-committed quantity is a floor once a batch has actually started (any BatchStage
 * has startedAt set) for the order a line belongs to: decreases are blocked outright (material
 * already committed/consumed), increases are blocked as an in-place edit too — the order detail
 * UI offers "Create additional order" for the delta instead, so the original order's committed
 * quantity is never mutated once production is underway. Pre-production edits pass through
 * unchanged, per the Lead->Order plan's Part 5 policy.
 */
export const interceptors: ApiInterceptor[] = [
  {
    id: 'dermat_sales_flow.order-lines.production-lock',
    targetRoute: 'sales/order-lines',
    methods: ['PUT'],
    priority: 100,
    async before(request, context) {
      const lineId = request.body?.id
      const nextQuantityRaw = request.body?.quantity
      if (typeof lineId !== 'string' || nextQuantityRaw === undefined) return { ok: true }
      const nextQuantity = Number(nextQuantityRaw)
      if (!Number.isFinite(nextQuantity)) return { ok: true }

      const line = await context.em.findOne(SalesOrderLine, {
        id: lineId,
        organizationId: context.organizationId,
        tenantId: context.tenantId,
      })
      if (!line) return { ok: true }

      const orderId = (line as unknown as { order: { id: string } | string }).order
      const resolvedOrderId = typeof orderId === 'string' ? orderId : orderId?.id
      if (!resolvedOrderId) return { ok: true }

      // dermat_production is a sibling app-level module — no direct entity import (FK-id +
      // raw-SQL fetch pattern, same idiom as dealAdvanceReceivedConversion.ts).
      const startedStageRows = await context.em.getConnection().execute<Array<{ id: string }>>(
        `select bs.id
         from dermat_batch_stages bs
         join dermat_production_batches pb on pb.id = bs.production_batch_id
         where pb.order_id = ? and pb.organization_id = ? and pb.tenant_id = ? and bs.started_at is not null
         limit 1`,
        [resolvedOrderId, context.organizationId, context.tenantId],
      )
      if (startedStageRows.length === 0) return { ok: true }

      const currentQuantity = Number(line.quantity)
      if (nextQuantity < currentQuantity) {
        return {
          ok: false,
          statusCode: 422,
          message:
            'This order is already in production — the committed quantity cannot be reduced because material has already been consumed. Contact production to discuss the change.',
        }
      }
      if (nextQuantity > currentQuantity) {
        return {
          ok: false,
          statusCode: 422,
          message:
            'This order is already in production — quantity cannot be increased in place. Use "Create additional order" on the order page to place the extra quantity as a new, separately produced order.',
        }
      }
      return { ok: true }
    },
  },
  {
    id: 'dermat_sales_flow.production-batches.sampling-gate',
    targetRoute: 'dermat_production/batches',
    methods: ['POST'],
    priority: 100,
    async before(request, context) {
      const orderId = request.body?.orderId
      if (typeof orderId !== 'string' || !orderId) return { ok: true }

      // dermat_sampling is a sibling app-level module — no direct entity import (FK-id +
      // raw-SQL fetch pattern, same idiom as the production-lock interceptor above).
      const sampleRows = await context.em.getConnection().execute<Array<{ status: string }>>(
        `select status
         from dermat_samples
         where order_id = ? and organization_id = ? and tenant_id = ? and deleted_at is null
         order by created_at desc
         limit 1`,
        [orderId, context.organizationId, context.tenantId],
      )

      if (sampleRows.length === 0) {
        return {
          ok: false,
          statusCode: 422,
          message:
            'This order requires an approved R&D sample before production can start. Use "Request Sample" on the order page.',
        }
      }

      const latestStatus = sampleRows[0].status
      if (latestStatus !== 'approved') {
        return {
          ok: false,
          statusCode: 422,
          message: `This order's R&D sample is not yet approved (current status: ${latestStatus.replace(/_/g, ' ')}). Production cannot start until the customer approves a sample.`,
        }
      }

      return { ok: true }
    },
  },
]

export default interceptors
