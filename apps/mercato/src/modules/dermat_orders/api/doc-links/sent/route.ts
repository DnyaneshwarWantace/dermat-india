import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { currentUserName, resolveOrderContext } from '../../../lib/server'
import { orderErrorResponse } from '../../../lib/guard'
import { findLink, linkView, logSend } from '../../../lib/docLinks'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['dermat_orders.view'] },
}

const bodySchema = z.object({ id: z.string().uuid(), via: z.enum(['email', 'whatsapp', 'copy']), to: z.string().trim().max(200).optional().nullable() })

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid send' }, { status: 400 })
  try {
    const link = await findLink(ctx, parsed.data.id)
    await logSend(ctx, link, parsed.data.via, parsed.data.to ?? null, await currentUserName(ctx))
    return NextResponse.json(linkView(link))
  } catch (error) {
    return orderErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Log a document send',
  methods: {
    POST: { summary: 'Record that a link was sent by email / WhatsApp / copied, by whom and to whom', tags: ['Dermat Orders'], requestBody: { schema: bodySchema }, responses: [{ status: 200, description: 'Link', schema: z.object({ id: z.string() }).passthrough() }] },
  },
}

export { POST }
