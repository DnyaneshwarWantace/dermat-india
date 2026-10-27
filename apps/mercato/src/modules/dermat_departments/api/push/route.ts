import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { resolveOrderContext } from '../../../dermat_orders/lib/server'
import { PushSubscriptionRecord } from '../../data/entities'
import { pushPublicKey, pushReady, pushToUser } from '../../lib/webPush'

export const metadata = {
  GET: { requireAuth: true },
  POST: { requireAuth: true },
  DELETE: { requireAuth: true },
}

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000).refine((value) => value.startsWith('https://'), 'Push address must be https'),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  test: z.boolean().optional(),
})
const removeSchema = z.object({ endpoint: z.string().max(1000) })

type Ctx = Exclude<Awaited<ReturnType<typeof resolveOrderContext>>, { error: string }>

async function guarded(ctx: Ctx, req: Request, payload: Record<string, unknown>, run: () => Promise<Response>): Promise<Response> {
  const guard = await runRouteMutationGuards({
    container: ctx.container,
    req,
    auth: { userId: ctx.userId ?? 'system', tenantId: ctx.tenantId, organizationId: ctx.organizationId },
    input: { resourceKind: 'dermat_departments.push', resourceId: ctx.userId ?? 'self', operation: 'custom', mutationPayload: payload },
  })
  if (!guard.ok) return guard.response
  const result = await run()
  await guard.runAfterSuccess()
  return result
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const count = ctx.userId ? await ctx.em.count(PushSubscriptionRecord, { tenantId: ctx.tenantId, userId: ctx.userId }) : 0
  return NextResponse.json({ ready: pushReady(), publicKey: pushPublicKey(), devices: count })
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  if (!ctx.userId) return NextResponse.json({ error: 'Sign in again' }, { status: 401 })
  if (!pushReady()) return NextResponse.json({ error: 'Phone alerts are not set up on this server yet' }, { status: 409 })
  const parsed = subscribeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid subscription' }, { status: 400 })
  const userId = ctx.userId
  return guarded(ctx, req, { endpoint: parsed.data.endpoint }, async () => {
    const existing = await ctx.em.findOne(PushSubscriptionRecord, { endpoint: parsed.data.endpoint })
    if (existing && existing.tenantId !== ctx.tenantId) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    const row = existing ?? ctx.em.create(PushSubscriptionRecord, { organizationId: ctx.organizationId, tenantId: ctx.tenantId, userId, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth })
    row.userId = userId
    row.p256dh = parsed.data.keys.p256dh
    row.auth = parsed.data.keys.auth
    row.userAgent = (req.headers.get('user-agent') ?? '').slice(0, 300) || null
    ctx.em.persist(row)
    await ctx.em.flush()
    const sent = parsed.data.test ? await pushToUser(ctx.em, { tenantId: ctx.tenantId, userId }, { title: 'Phone alerts are on', body: 'Your new tasks will pop up on this phone.', link: '/backend/my-work', tag: 'dermat-push-test' }) : 0
    return NextResponse.json({ ok: true, sent })
  })
}

async function DELETE(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = removeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  return guarded(ctx, req, { endpoint: parsed.data.endpoint }, async () => {
    await ctx.em.nativeDelete(PushSubscriptionRecord, { endpoint: parsed.data.endpoint, tenantId: ctx.tenantId, userId: ctx.userId ?? '' })
    return NextResponse.json({ ok: true })
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Departments',
  summary: 'Phone pop-up alerts for the signed-in person',
  methods: {
    GET: { summary: 'Whether phone alerts are set up, the public key, and how many of my phones are on', tags: ['Dermat Departments'], responses: [{ status: 200, description: 'State', schema: z.object({ ready: z.boolean(), publicKey: z.string().nullable(), devices: z.number() }) }] },
    POST: { summary: 'Turn on phone alerts for this browser', tags: ['Dermat Departments'], requestBody: { schema: subscribeSchema }, responses: [{ status: 200, description: 'Saved', schema: z.object({ ok: z.boolean(), sent: z.number() }) }] },
    DELETE: { summary: 'Turn off phone alerts for this browser', tags: ['Dermat Departments'], requestBody: { schema: removeSchema }, responses: [{ status: 200, description: 'Removed', schema: z.object({ ok: z.boolean() }) }] },
  },
}

export { GET, POST, DELETE }
