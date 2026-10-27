import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { enforceCommandOptimisticLock } from '@open-mercato/shared/lib/crud/optimistic-lock-command'
import { currentUserName, resolveOrderContext } from '../../../dermat_orders/lib/server'
import { SampleCharge } from '../../data/entities'
import { sampleChargeInputSchema, sampleChargeQuerySchema, sampleChargeVoidSchema } from '../../data/validators'
import { AccountsError } from '../../lib/service'
import { recordSampleCharge, sampleChargeView, sampleChargesFor, sampleTotal } from '../../lib/sampleCharges'
import { accountsErrorResponse, runGuarded } from '../../lib/server'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_accounts.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_accounts.record'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_accounts.record'] },
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = sampleChargeQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success || (!parsed.data.customerId && !parsed.data.rdRequestId)) return NextResponse.json({ error: 'customerId or rdRequestId is required' }, { status: 400 })
  const charges = await sampleChargesFor(ctx, parsed.data)
  return NextResponse.json({ items: charges.map(sampleChargeView), total: sampleTotal(charges) })
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = sampleChargeInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter the customer and the amount' }, { status: 400 })
  try {
    return await runGuarded(ctx, req, parsed.data.customerId, parsed.data, async () => {
      const charge = await recordSampleCharge(ctx, parsed.data, await currentUserName(ctx))
      return NextResponse.json(sampleChargeView(charge), { status: 201 })
    })
  } catch (error) {
    return accountsErrorResponse(error)
  }
}

async function PUT(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = sampleChargeVoidSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Write why the sample charge is voided' }, { status: 400 })
  try {
    const charge = await ctx.em.findOne(SampleCharge, { id: parsed.data.id, tenantId: ctx.tenantId, organizationId: ctx.organizationId })
    if (!charge) throw new AccountsError('Sample charge not found', 404)
    if (charge.voidedAt) throw new AccountsError('Already voided', 409)
    enforceCommandOptimisticLock({ resourceKind: 'dermat_accounts.sample_charge', resourceId: charge.id, current: charge.updatedAt, request: req })
    return await runGuarded(ctx, req, charge.id, parsed.data, async () => {
      charge.voidedAt = new Date()
      charge.voidReason = parsed.data.reason
      charge.note = [charge.note, `Voided by ${(await currentUserName(ctx)) ?? 'someone'}: ${parsed.data.reason}`].filter(Boolean).join(' · ')
      await ctx.em.flush()
      return NextResponse.json(sampleChargeView(charge))
    })
  } catch (error) {
    return accountsErrorResponse(error)
  }
}

const viewSchema = z.object({ id: z.string() }).passthrough()

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Accounts',
  summary: 'Sample charges: money taken for an R&D sample, kept apart from order advances',
  methods: {
    GET: { summary: 'Sample charges of a customer or an R&D request', tags: ['Dermat Accounts'], query: sampleChargeQuerySchema, responses: [{ status: 200, description: 'Sample charges', schema: z.object({ items: z.array(viewSchema), total: z.number() }) }] },
    POST: { summary: 'Record a sample charge', tags: ['Dermat Accounts'], requestBody: { schema: sampleChargeInputSchema }, responses: [{ status: 201, description: 'Recorded', schema: viewSchema }] },
    PUT: { summary: 'Void a sample charge with a reason', tags: ['Dermat Accounts'], requestBody: { schema: sampleChargeVoidSchema }, responses: [{ status: 200, description: 'Voided', schema: viewSchema }] },
  },
}

export { GET, POST, PUT }
