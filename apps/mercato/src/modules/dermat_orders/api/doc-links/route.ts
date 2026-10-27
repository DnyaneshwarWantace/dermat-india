import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { currentUserName, resolveOrderContext } from '../../lib/server'
import { orderErrorResponse } from '../../lib/guard'
import { DOC_KINDS, ensureLink, findLink, listLinks, revokeLink } from '../../lib/docLinks'
import type { DocLinkKind } from '../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_orders.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_orders.view'] },
  DELETE: { requireAuth: true, requireFeatures: ['dermat_orders.view'] },
}

const kind = z.enum(DOC_KINDS as [DocLinkKind, ...DocLinkKind[]])
const listSchema = z.object({ orderId: z.string().uuid().optional(), customerId: z.string().uuid().optional(), kind: kind.optional(), recordId: z.string().uuid().optional() })
const createSchema = z.object({ kind, recordId: z.string().uuid() })

async function guard(req: Request, ctx: Exclude<Awaited<ReturnType<typeof resolveOrderContext>>, { error: string }>, resourceId: string, payload: Record<string, unknown>) {
  return runRouteMutationGuards({
    container: ctx.container,
    req,
    auth: { userId: ctx.userId ?? 'system', tenantId: ctx.tenantId, organizationId: ctx.organizationId },
    input: { resourceKind: 'dermat_orders.doc_link', resourceId, operation: 'custom', mutationPayload: payload },
  })
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success || (!parsed.data.orderId && !parsed.data.customerId && !parsed.data.recordId)) return NextResponse.json({ error: 'Pass an order, a customer or a document' }, { status: 400 })
  return NextResponse.json({ items: await listLinks(ctx, parsed.data) })
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Pick a document' }, { status: 400 })
  try {
    const check = await guard(req, ctx, parsed.data.recordId, parsed.data)
    if (!check.ok) return check.response
    const result = await ensureLink(ctx, parsed.data.kind, parsed.data.recordId, await currentUserName(ctx))
    await check.runAfterSuccess()
    return NextResponse.json(result)
  } catch (error) {
    return orderErrorResponse(error)
  }
}

async function DELETE(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  try {
    const link = await findLink(ctx, id)
    const check = await guard(req, ctx, link.id, { id })
    if (!check.ok) return check.response
    await revokeLink(ctx, link)
    await check.runAfterSuccess()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Document links sent to customers and vendors',
  methods: {
    GET: { summary: 'Links of an order, a customer or one document, with sends and opens', tags: ['Dermat Orders'], query: listSchema, responses: [{ status: 200, description: 'Links', schema: z.object({ items: z.array(z.object({ id: z.string() }).passthrough()) }) }] },
    POST: { summary: 'Get (or make) the public link of a document', tags: ['Dermat Orders'], requestBody: { schema: createSchema }, responses: [{ status: 200, description: 'Link and default recipient', schema: z.object({ link: z.object({ path: z.string() }).passthrough() }).passthrough() }] },
    DELETE: { summary: 'Revoke a link', tags: ['Dermat Orders'], responses: [{ status: 200, description: 'Revoked' }] },
  },
}

export { GET, POST, DELETE }
