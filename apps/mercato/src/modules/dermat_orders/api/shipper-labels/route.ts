import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { findOrder, hasFeatures, resolveOrderContext } from '../../lib/server'
import { orderErrorResponse } from '../../lib/guard'
import { labelData } from '../../lib/shipperLabels'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['dermat_orders.view'] },
}

const bodySchema = z.object({ orderId: z.string().uuid() })

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  let allowed = false
  for (const feature of ['dermat_orders.work.production', 'dermat_orders.work.packing', 'dermat_orders.work.dispatch', 'dermat_orders.manage']) if (!allowed && (await hasFeatures(ctx, [feature]))) allowed = true
  if (!allowed) return NextResponse.json({ error: 'Only Production, Dispatch or Sales can print shipper labels' }, { status: 403 })
  try {
    const order = await findOrder(ctx, parsed.data.orderId)
    return NextResponse.json(await labelData(ctx, order))
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Shipper label data',
  methods: {
    POST: { summary: 'Product, batch, dates and the scan code for the shipper labels of an order', tags: ['Dermat Orders'], requestBody: { schema: bodySchema }, responses: [{ status: 200, description: 'Label data', schema: z.object({ token: z.string() }).passthrough() }] },
  },
}

export { POST }
