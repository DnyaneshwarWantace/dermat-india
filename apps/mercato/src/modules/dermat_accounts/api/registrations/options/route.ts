import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveOrderContext } from '../../../../dermat_orders/lib/server'
import { loadCompany } from '../../../lib/documents'
import { registrationOptions } from '../../../lib/registrations'
import { accountsErrorResponse, runGuarded } from '../../../lib/server'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_accounts.view'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_accounts.record'] },
}

const optionsSchema = z.object({ askCountry: z.boolean() })

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  return NextResponse.json(await registrationOptions(ctx.em, ctx))
}

async function PUT(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = optionsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid options' }, { status: 400 })
  try {
    const profile = await loadCompany(ctx)
    if (!profile) return NextResponse.json({ error: 'Fill in the company details under Accounts → Company first' }, { status: 409 })
    return await runGuarded(ctx, req, profile.id, parsed.data, async () => {
      profile.formOptions = { ...(profile.formOptions ?? {}), askCountry: parsed.data.askCountry }
      profile.updatedAt = new Date()
      await ctx.em.flush()
      return NextResponse.json(await registrationOptions(ctx.em, ctx))
    })
  } catch (error) {
    return accountsErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Accounts',
  summary: 'Customer registration form options',
  methods: {
    GET: { summary: 'Which optional questions the registration form asks', tags: ['Dermat Accounts'], responses: [{ status: 200, description: 'Options', schema: optionsSchema }] },
    PUT: { summary: 'Turn optional registration questions on or off (e.g. country)', tags: ['Dermat Accounts'], requestBody: { schema: optionsSchema }, responses: [{ status: 200, description: 'Options', schema: optionsSchema }] },
  },
}

export { GET, PUT }
