import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { currentUserName, findOrder, hasFeatures, resolveOrderContext } from '../../lib/server'
import { orderErrorResponse } from '../../lib/guard'
import { createApproval, listApprovals } from '../../lib/artworkApproval'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_orders.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_orders.stages'] },
}

const listSchema = z.object({ orderId: z.string().uuid() })
const createSchema = z.object({ orderId: z.string().uuid() })

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  try {
    const order = await findOrder(ctx, parsed.data.orderId)
    return NextResponse.json({ items: await listApprovals(ctx, order.id) })
  } catch (error) {
    return orderErrorResponse(error)
  }
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  const allowed = (await hasFeatures(ctx, ['dermat_orders.work.artwork'])) || (await hasFeatures(ctx, ['dermat_orders.manage']))
  if (!allowed) return NextResponse.json({ error: 'Only Artwork or Sales can send the artwork to the client' }, { status: 403 })
  try {
    const order = await findOrder(ctx, parsed.data.orderId)
    const guard = await runRouteMutationGuards({
      container: ctx.container,
      req,
      auth: { userId: ctx.userId ?? 'system', tenantId: ctx.tenantId, organizationId: ctx.organizationId },
      input: { resourceKind: 'dermat_orders.artwork_approval', resourceId: order.id, operation: 'create', mutationPayload: parsed.data },
    })
    if (!guard.ok) return guard.response
    const { token, approval } = await createApproval(ctx, order, await currentUserName(ctx))
    await guard.runAfterSuccess()
    return NextResponse.json({ id: approval.id, token, path: `/approve/artwork/${token}` }, { status: 201 })
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Client approval links for artwork',
  methods: {
    GET: { summary: 'Approval links sent for an order, with the client decision, signature, time and IP', tags: ['Dermat Orders'], query: listSchema, responses: [{ status: 200, description: 'Links', schema: z.object({ items: z.array(z.object({ id: z.string() }).passthrough()) }) }] },
    POST: { summary: 'Create a one-time approval link for the current artwork (older open links close)', tags: ['Dermat Orders'], requestBody: { schema: createSchema }, responses: [{ status: 201, description: 'Link', schema: z.object({ id: z.string(), path: z.string() }) }] },
  },
}

export { GET, POST }
