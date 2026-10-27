import { NextResponse } from 'next/server'
import { withSupplierMask } from '../../../../dermat_products/lib/suppliers'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { findOrder, hasFeatures, resolveOrderContext } from '../../../lib/server'
import { packItems } from '../../../lib/productionStock'
import { orderErrorResponse } from '../../../lib/guard'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_orders.view'] },
}

const querySchema = z.object({ orderId: z.string().uuid() })

async function getUnmasked(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  try {
    const order = await findOrder(ctx, parsed.data.orderId)
    const items = await packItems(ctx, order.id)
    const ids = items.map((item) => item.productId)
    const stock = ids.length
      ? await ctx.em.getConnection().execute<Array<{ product_id: string; on_hand: string }>>(
          `select v.product_id, coalesce(sum(b.quantity_on_hand), 0)::text as on_hand
             from catalog_product_variants v
             left join wms_inventory_balances b on b.catalog_variant_id = v.id and b.deleted_at is null
             left join wms_inventory_lots lot on lot.id = b.lot_id
            where v.product_id = any(?::uuid[]) and v.deleted_at is null and coalesce(lot.status, 'available') = 'available'
            group by v.product_id`,
          [`{${ids.join(',')}}`],
        )
      : []
    const onHand = new Map(stock.map((row) => [row.product_id, Number(row.on_hand)]))
    const rows = await ctx.em.getConnection().execute<Array<{ id: string; code: string; status: string; vendor_name: string | null; po_date: string; product_id: string; quantity: string; received_qty: string }>>(
      `select po.id, po.code, po.status, po.vendor_name, po.po_date, l.product_id, l.quantity::text, l.received_qty::text
         from dermat_pos po join dermat_po_lines l on l.po_id = po.id
        where po.tenant_id = ? and po.organization_id = ? and po.deleted_at is null and po.status <> 'cancelled'
          and po.order_refs @> ?::jsonb
        order by po.created_at desc`,
      [ctx.tenantId, ctx.organizationId, JSON.stringify([{ orderId: order.id }])],
    )
    const seeVendor = (await hasFeatures(ctx, ['dermat_products.supplier'])) || (await hasFeatures(ctx, ['dermat_purchase.view']))
    const pos = new Map<string, { id: string; code: string; status: string; vendorName: string | null; poDate: string; lines: Array<{ productId: string; quantity: number; received: number }> }>()
    for (const row of rows) {
      const entry = pos.get(row.id) ?? { id: row.id, code: row.code, status: row.status, vendorName: seeVendor ? row.vendor_name : null, poDate: row.po_date, lines: [] }
      entry.lines.push({ productId: row.product_id, quantity: Number(row.quantity), received: Number(row.received_qty) })
      pos.set(row.id, entry)
    }
    const ordered = new Map<string, number>()
    for (const po of pos.values()) for (const line of po.lines) ordered.set(line.productId, (ordered.get(line.productId) ?? 0) + line.quantity)
    return NextResponse.json({
      orderNo: order.orderNo,
      items: items.map((item) => ({ ...item, onHand: onHand.get(item.productId) ?? 0, onPo: ordered.get(item.productId) ?? 0 })),
      pos: Array.from(pos.values()),
    })
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Packing material of an order and its purchase orders',
  methods: {
    GET: {
      summary: 'Packing items the order needs with stock and quantity on PO, and the POs raised for this order',
      tags: ['Dermat Orders'],
      query: querySchema,
      responses: [{ status: 200, description: 'Packing material', schema: z.object({ items: z.array(z.object({ productId: z.string() }).passthrough()), pos: z.array(z.object({ id: z.string() }).passthrough()) }) }],
    },
  },
}

const GET = withSupplierMask(getUnmasked)

export { GET }
