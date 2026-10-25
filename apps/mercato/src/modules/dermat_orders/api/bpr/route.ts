import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveOrderContext } from '../../lib/server'
import { orderErrorResponse, runGuarded } from '../../lib/guard'
import { resolveOrderAccess } from '../../lib/visibility'
import { canSeeMoney } from '../../lib/money'
import { loadStageOverrides } from '../../lib/stageSettings'
import { BPR_SECTIONS } from '../../lib/bpr'
import { applyBprAction, bprView } from '../../lib/bprRecord'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_orders.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_orders.stages'] },
}

const querySchema = z.object({ batch: z.string().trim().min(1).max(80) })

const label = z.string().trim().min(1).max(120)
const actionSchema = z.object({
  batch: z.string().trim().min(1).max(80),
  action: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('cleaning'), equipment: label, equipmentId: z.string().trim().max(80).nullable().optional(), method: z.string().trim().max(200).nullable().optional(), status: z.enum(['Clean', 'Not clean']) }),
    z.object({ kind: z.literal('leak'), tested: z.coerce.number().int().min(1).max(100000), failed: z.coerce.number().int().min(0).max(100000), note: z.string().trim().max(500).nullable().optional() }),
    z.object({ kind: z.literal('destroyed'), productId: z.string().uuid(), quantity: z.coerce.number().min(0).max(100_000_000) }),
    z.object({ kind: z.literal('verify'), section: z.enum(BPR_SECTIONS) }),
    z.object({ kind: z.literal('remove'), list: z.enum(['cleaning', 'leak']), at: z.string().max(40) }),
  ]),
})

async function viewFor(ctx: Exclude<Awaited<ReturnType<typeof resolveOrderContext>>, { error: string }>, batch: string) {
  return bprView(ctx, batch, { access: await resolveOrderAccess(ctx), overrides: await loadStageOverrides(ctx), money: await canSeeMoney(ctx) })
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  try {
    return NextResponse.json(await viewFor(ctx, parsed.data.batch))
  } catch (error) {
    return orderErrorResponse(error)
  }
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Please check the entry' }, { status: 400 })
  try {
    return await runGuarded(ctx, req, { resourceId: parsed.data.batch, operation: 'update', payload: parsed.data }, async () => {
      await applyBprAction(ctx, parsed.data.batch, parsed.data.action)
      return NextResponse.json(await viewFor(ctx, parsed.data.batch))
    })
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Batch packing record',
  methods: {
    GET: { summary: 'The batch packing record (BPR) of one batch', tags: ['Dermat Orders'], query: querySchema, responses: [{ status: 200, description: 'BPR', schema: z.object({}).passthrough() }] },
    POST: { summary: 'Add a cleaning, leak test, destroyed material or QA verification entry to the BPR', tags: ['Dermat Orders'], requestBody: { schema: actionSchema }, responses: [{ status: 200, description: 'BPR', schema: z.object({}).passthrough() }], errors: [{ status: 403, description: 'Not your part of the record' }, { status: 409, description: 'Stage not in progress' }] },
  },
}

export { GET, POST }
