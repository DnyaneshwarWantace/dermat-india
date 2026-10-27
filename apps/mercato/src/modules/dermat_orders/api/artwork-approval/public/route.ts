import { NextResponse } from 'next/server'
import { publicRateLimit } from '../../../lib/rateLimit'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { orderErrorResponse } from '../../../lib/guard'
import { approvalByToken, publicApprovalView, recordDecision } from '../../../lib/artworkApproval'

export const metadata = {
  GET: { requireAuth: false },
  POST: { requireAuth: false },
}

const querySchema = z.object({ token: z.string().min(20).max(80) })
const decisionSchema = z.object({
  token: z.string().min(20).max(80),
  decision: z.enum(['approve', 'changes']),
  name: z.string().trim().min(2, 'Please type your name').max(120),
  designation: z.string().trim().max(120).optional().nullable(),
  signature: z.string().max(300_000),
  comments: z.string().trim().max(2000).optional().nullable(),
})

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  return (forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip'))?.trim() || null
}

async function GET(req: Request) {
  const limited = publicRateLimit(req, 'artwork-approval')
  if (limited) return limited
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'This link is not valid' }, { status: 404 })
  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()
  try {
    const row = await approvalByToken(em, parsed.data.token)
    return NextResponse.json(await publicApprovalView(em, row))
  } catch (error) {
    return orderErrorResponse(error)
  }
}

async function POST(req: Request) {
  const limited = publicRateLimit(req, 'artwork-approval', 20)
  if (limited) return limited
  const parsed = decisionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Please fill in the form' }, { status: 400 })
  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()
  try {
    const row = await approvalByToken(em, parsed.data.token)
    await recordDecision(em, container, row, { decision: parsed.data.decision, name: parsed.data.name, designation: parsed.data.designation ?? null, signature: parsed.data.signature, comments: parsed.data.comments ?? null }, clientIp(req), req.headers.get('user-agent'))
    return NextResponse.json(await publicApprovalView(em, row))
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Client artwork approval (public link)',
  methods: {
    GET: { summary: 'What the client sees on the approval link', tags: ['Dermat Orders'], query: querySchema, responses: [{ status: 200, description: 'Artwork for approval', schema: z.object({ status: z.string() }).passthrough() }] },
    POST: { summary: 'Client approves or asks for changes, with name and signature', tags: ['Dermat Orders'], requestBody: { schema: decisionSchema }, responses: [{ status: 200, description: 'Recorded', schema: z.object({ status: z.string() }).passthrough() }] },
  },
}

export { GET, POST }
