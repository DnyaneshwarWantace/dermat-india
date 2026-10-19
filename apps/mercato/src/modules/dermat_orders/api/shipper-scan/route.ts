import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { orderErrorResponse } from '../../lib/guard'
import { scanData } from '../../lib/shipperLabels'

export const metadata = {
  GET: { requireAuth: false },
}

const querySchema = z.object({ token: z.string().min(20).max(40) })

async function GET(req: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'This label is not known' }, { status: 404 })
  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()
  try {
    return NextResponse.json(await scanData(em, parsed.data.token))
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Shipper label scan (public)',
  methods: {
    GET: { summary: 'What a scanned shipper label shows: order, product, batch and dates (no prices)', tags: ['Dermat Orders'], query: querySchema, responses: [{ status: 200, description: 'Shipment', schema: z.object({ orderNo: z.string() }).passthrough() }] },
  },
}

export { GET }
