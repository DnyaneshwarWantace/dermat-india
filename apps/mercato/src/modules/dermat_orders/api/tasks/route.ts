import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveOrderContext } from '../../lib/server'
import { withStageOverrides } from '../../lib/stageSettings'
import { taskList } from '../../lib/tasks'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_orders.stages'] },
}

const querySchema = z.object({ scope: z.enum(['mine', 'department']).default('department') })

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  return withStageOverrides(ctx, async () => NextResponse.json({ items: await taskList(ctx, parsed.data.scope) }))
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'My tasks',
  methods: {
    GET: {
      summary: 'Open stage cards assigned to me (mine) or that my department can finish (department), overdue first',
      tags: ['Dermat Orders'],
      query: querySchema,
      responses: [{ status: 200, description: 'Open cards', schema: z.object({ items: z.array(z.object({ orderId: z.string(), cardKey: z.string() }).passthrough()) }) }],
    },
  },
}

export { GET }
