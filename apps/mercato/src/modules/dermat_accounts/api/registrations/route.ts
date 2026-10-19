import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { enforceCommandOptimisticLock } from '@open-mercato/shared/lib/crud/optimistic-lock-command'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { currentUserName, resolveOrderContext } from '../../../dermat_orders/lib/server'
import { accountsErrorResponse } from '../../lib/server'
import { createRegistration, decideRegistration, findRegistration, listRegistrations, registrationView } from '../../lib/registrations'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_accounts.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_accounts.view'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_accounts.record'] },
}

const listSchema = z.object({ status: z.enum(['open', 'submitted', 'approved', 'rejected']).optional() })
const createSchema = z.object({ customerId: z.string().uuid().nullable().optional() })
const decideSchema = z.object({ id: z.string().uuid(), decision: z.enum(['approve', 'reject']), target: z.union([z.literal('new'), z.string().uuid()]).nullable().optional(), note: z.string().trim().max(500).nullable().optional() })

type Ctx = Exclude<Awaited<ReturnType<typeof resolveOrderContext>>, { error: string }>

async function guarded<T>(ctx: Ctx, req: Request, resourceId: string, payload: Record<string, unknown>, run: () => Promise<T>): Promise<T | Response> {
  const guard = await runRouteMutationGuards({
    container: ctx.container,
    req,
    auth: { userId: ctx.userId ?? 'system', tenantId: ctx.tenantId, organizationId: ctx.organizationId },
    input: { resourceKind: 'dermat_accounts.registration', resourceId, operation: 'custom', mutationPayload: payload },
  })
  if (!guard.ok) return guard.response
  const result = await run()
  await guard.runAfterSuccess()
  return result
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  return NextResponse.json({ items: await listRegistrations(ctx, parsed.data.status) })
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Pick a customer or leave it empty' }, { status: 400 })
  try {
    return await guarded(ctx, req, parsed.data.customerId ?? 'new', parsed.data, async () => {
      const row = await createRegistration(ctx, parsed.data.customerId ?? null, await currentUserName(ctx))
      return NextResponse.json(registrationView(row), { status: 201 })
    })
  } catch (error) {
    return accountsErrorResponse(error)
  }
}

async function PUT(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = decideSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Approve or reject' }, { status: 400 })
  try {
    const row = await findRegistration(ctx, parsed.data.id)
    enforceCommandOptimisticLock({ resourceKind: 'dermat_accounts.registration', resourceId: row.id, current: row.updatedAt, request: req })
    return await guarded(ctx, req, row.id, parsed.data, async () => {
      await decideRegistration(ctx, req, row, parsed.data, await currentUserName(ctx))
      return NextResponse.json(registrationView(row))
    })
  } catch (error) {
    return accountsErrorResponse(error)
  }
}

const view = z.object({ id: z.string(), status: z.string() }).passthrough()

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Accounts',
  summary: 'Customer registration links',
  methods: {
    GET: { summary: 'Registration links and filled forms', tags: ['Dermat Accounts'], query: listSchema, responses: [{ status: 200, description: 'Registrations', schema: z.object({ items: z.array(view) }) }] },
    POST: { summary: 'Make a registration link (general, or for one customer)', tags: ['Dermat Accounts'], requestBody: { schema: createSchema }, responses: [{ status: 201, description: 'Link made', schema: view }] },
    PUT: { summary: 'Approve (creates the customer with contacts and addresses, or adds them to an existing customer) or reject a filled form', tags: ['Dermat Accounts'], requestBody: { schema: decideSchema }, responses: [{ status: 200, description: 'Decided', schema: view }] },
  },
}

export { GET, POST, PUT }
