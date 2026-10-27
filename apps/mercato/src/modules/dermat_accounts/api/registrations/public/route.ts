import { NextResponse } from 'next/server'
import { publicRateLimit } from '../../../../dermat_orders/lib/rateLimit'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { accountsErrorResponse } from '../../../lib/server'
import { publicRegistration, registrationByToken, submitRegistration } from '../../../lib/registrations'

export const metadata = {
  GET: { requireAuth: false },
  POST: { requireAuth: false },
}

const querySchema = z.object({ token: z.string().min(20).max(40) })
const submitSchema = z.object({ token: z.string().min(20).max(40), answers: z.record(z.string(), z.string().max(1000)), website: z.string().max(200).optional(), startedAt: z.number().int() })

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  return (forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip'))?.trim() || null
}

async function GET(req: Request) {
  const limited = publicRateLimit(req, 'registration')
  if (limited) return limited
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'This link is not valid' }, { status: 404 })
  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()
  try {
    return NextResponse.json(await publicRegistration(em, await registrationByToken(em, parsed.data.token)))
  } catch (error) {
    return accountsErrorResponse(error)
  }
}

async function POST(req: Request) {
  const limited = publicRateLimit(req, 'registration', 20)
  if (limited) return limited
  const parsed = submitSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Please check the form' }, { status: 400 })
  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()
  try {
    const row = await registrationByToken(em, parsed.data.token)
    await submitRegistration(em, container, row, parsed.data, clientIp(req))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return accountsErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Accounts',
  summary: 'Public customer registration form',
  methods: {
    GET: { summary: 'Whether the form behind a link is still open', tags: ['Dermat Accounts'], query: querySchema, responses: [{ status: 200, description: 'Form state', schema: z.object({ status: z.string() }).passthrough() }] },
    POST: { summary: 'The customer submits the registration form', tags: ['Dermat Accounts'], requestBody: { schema: submitSchema }, responses: [{ status: 200, description: 'Saved', schema: z.object({ ok: z.boolean() }) }] },
  },
}

export { GET, POST }
