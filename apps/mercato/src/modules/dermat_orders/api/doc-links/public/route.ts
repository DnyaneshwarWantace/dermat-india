import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { orderErrorResponse } from '../../../lib/guard'
import { publicDocument, publicLink } from '../../../lib/docLinks'

export const metadata = {
  GET: { requireAuth: false },
}

const querySchema = z.object({ token: z.string().min(20).max(40) })

async function GET(req: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'This link is not valid' }, { status: 404 })
  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()
  try {
    return NextResponse.json(await publicDocument(em, await publicLink(em, parsed.data.token)))
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Public document link',
  methods: {
    GET: { summary: 'The document behind a link (PI, invoice, PO, dispatch details or sample sheet)', tags: ['Dermat Orders'], query: querySchema, responses: [{ status: 200, description: 'Document', schema: z.object({ kind: z.string() }).passthrough() }] },
  },
}

export { GET }
