import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { currentUserName, resolveOrderContext } from '../../../dermat_orders/lib/server'
import { AccessLogEntry } from '../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['auth.acl.manage'] },
  POST: { requireAuth: true, requireFeatures: ['auth.acl.manage'] },
}

const feature = z.string().trim().min(1).max(120)
const entrySchema = z.object({ userId: z.string().uuid(), userName: z.string().trim().max(200).nullable().optional(), added: z.array(feature).max(200), removed: z.array(feature).max(200) })

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const rows = await ctx.em.find(AccessLogEntry, { tenantId: ctx.tenantId, organizationId: ctx.organizationId }, { orderBy: { createdAt: 'desc' }, limit: 100 })
  return NextResponse.json({
    items: rows.map((row) => ({ id: row.id, userId: row.userId, userName: row.userName ?? null, changedByName: row.changedByName ?? null, added: row.added, removed: row.removed, at: row.createdAt.toISOString() })),
  })
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = entrySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid change' }, { status: 400 })
  if (!parsed.data.added.length && !parsed.data.removed.length) return NextResponse.json({ ok: true })
  const guard = await runRouteMutationGuards({
    container: ctx.container,
    req,
    auth: { userId: ctx.userId ?? 'system', tenantId: ctx.tenantId, organizationId: ctx.organizationId },
    input: { resourceKind: 'dermat_departments.access_log', resourceId: parsed.data.userId, operation: 'create', mutationPayload: parsed.data },
  })
  if (!guard.ok) return guard.response
  ctx.em.persist(ctx.em.create(AccessLogEntry, { tenantId: ctx.tenantId, organizationId: ctx.organizationId, userId: parsed.data.userId, userName: parsed.data.userName ?? null, changedByName: await currentUserName(ctx), added: parsed.data.added, removed: parsed.data.removed }))
  await ctx.em.flush()
  await guard.runAfterSuccess()
  return NextResponse.json({ ok: true }, { status: 201 })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Departments',
  summary: 'Who changed whose access',
  methods: {
    GET: { summary: 'Last 100 access changes made on the allowance sheet', tags: ['Dermat Departments'], responses: [{ status: 200, description: 'Changes', schema: z.object({ items: z.array(z.object({ id: z.string() }).passthrough()) }) }] },
    POST: { summary: 'Record one person’s access change', tags: ['Dermat Departments'], requestBody: { schema: entrySchema }, responses: [{ status: 201, description: 'Recorded', schema: z.object({ ok: z.boolean() }) }] },
  },
}

export { GET, POST }
