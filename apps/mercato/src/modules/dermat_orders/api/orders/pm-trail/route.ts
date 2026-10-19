import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { DermatOrderLine, DermatOrderStage } from '../../../data/entities'
import { findOrder, resolveOrderContext } from '../../../lib/server'
import { packItems } from '../../../lib/productionStock'
import { orderErrorResponse } from '../../../lib/guard'
import { isPrimaryPack } from '../../../../dermat_store/lib/service'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_orders.view'] },
}

const querySchema = z.object({ orderId: z.string().uuid() })

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  try {
    const order = await findOrder(ctx, parsed.data.orderId)
    const [items, lines, stages] = await Promise.all([
      packItems(ctx, order.id),
      ctx.em.find(DermatOrderLine, { orderId: order.id }),
      ctx.em.find(DermatOrderStage, { orderId: order.id, stageKey: { $in: ['filling', 'packing'] } }),
    ])
    const pieces = lines.reduce((sum, line) => sum + num(line.quantity), 0) || 1
    const filling = stages.find((stage) => stage.stageKey === 'filling')
    const packing = stages.find((stage) => stage.stageKey === 'packing')
    const filled = num(filling?.data?.filled_units)
    const fillRejected = num(filling?.data?.rejected_units)
    const handed = filling?.data?.handed_to_packing === undefined || filling?.data?.handed_to_packing === null ? Math.max(0, filled - fillRejected) : num(filling?.data?.handed_to_packing)
    const packed = num(packing?.data?.packed_qty)
    const packRejected = num(packing?.data?.rejected_pcs)
    const ids = items.map((item) => item.productId)
    const store = ids.length
      ? await ctx.em.getConnection().execute<Array<{ product_id: string; stage_key: string; issued: string; received: string; used: string; returned: string }>>(
          `select l.product_id, r.stage_key, sum(l.issued_qty)::text as issued, sum(l.received_qty)::text as received, sum(l.used_qty)::text as used, sum(l.returned_qty)::text as returned
             from dermat_store_request_lines l join dermat_store_requests r on r.id = l.request_id and r.deleted_at is null and r.status <> 'cancelled'
            where r.order_id = ? and r.tenant_id = ? and r.organization_id = ? and l.product_id = any(?::uuid[])
            group by l.product_id, r.stage_key`,
          [order.id, ctx.tenantId, ctx.organizationId, `{${ids.join(',')}}`],
        )
      : []
    const types = ids.length
      ? await ctx.em.getConnection().execute<Array<{ record_id: string; value_text: string | null }>>(
          `select record_id, value_text from custom_field_values where entity_id = 'catalog:catalog_product' and field_key = 'packing_item_type' and deleted_at is null and record_id = any(?::text[])`,
          [`{${ids.join(',')}}`],
        )
      : []
    const typeOf = new Map(types.map((row) => [row.record_id, row.value_text]))
    const rows = items.map((item) => {
      const own = store.filter((row) => row.product_id === item.productId)
      const issued = own.reduce((sum, row) => sum + num(row.issued), 0)
      const received = own.reduce((sum, row) => sum + num(row.received), 0)
      const returned = own.reduce((sum, row) => sum + num(row.returned), 0)
      const perPiece = item.quantity / pieces
      const primary = isPrimaryPack(item.title, typeOf.get(item.productId))
      const usedGood = primary ? perPiece * Math.max(0, filled - fillRejected) : perPiece * packed
      const rejected = primary ? perPiece * fillRejected : perPiece * packRejected
      const finished = primary ? Boolean(filling?.status === 'done') : Boolean(packing?.status === 'done')
      const unaccounted = finished ? received - returned - usedGood - rejected : 0
      return {
        productId: item.productId,
        title: item.title,
        code: item.code,
        unit: item.unit,
        primary,
        perPiece: round(perPiece),
        needed: round(item.quantity),
        issued: round(issued),
        received: round(received),
        used: round(usedGood),
        rejected: round(rejected),
        returned: round(returned),
        unaccounted: round(unaccounted),
        notReceived: round(Math.max(0, issued - received)),
      }
    })
    return NextResponse.json({ pieces, filled, fillRejected, handedToPacking: handed, packed, packRejected, items: rows })
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Where every packing item of an order went',
  methods: {
    GET: {
      summary: 'Per packing item: needed, issued, received, used in filling / packing, rejected, returned, unaccounted',
      tags: ['Dermat Orders'],
      query: querySchema,
      responses: [{ status: 200, description: 'Packing material trail', schema: z.object({ items: z.array(z.object({ productId: z.string() }).passthrough()) }).passthrough() }],
    },
  },
}

export { GET }
