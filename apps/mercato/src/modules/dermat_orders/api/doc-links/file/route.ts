import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { StorageDriverFactory } from '@open-mercato/core/modules/attachments/lib/drivers'
import { buildAttachmentContentDisposition, canRenderInlineAttachment } from '@open-mercato/core/modules/attachments/lib/security'
import { publicFileAllowed, publicLink } from '../../../lib/docLinks'

export const metadata = {
  GET: { requireAuth: false },
}

const querySchema = z.object({ token: z.string().min(20).max(40), id: z.string().uuid() })

async function GET(req: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const container = await createRequestContainer()
  const em = (container.resolve('em') as EntityManager).fork()
  let row
  try {
    row = await publicLink(em, parsed.data.token)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!(await publicFileAllowed(em, row, parsed.data.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const attachment = await em.findOne(Attachment, { id: parsed.data.id, tenantId: row.tenantId, organizationId: row.organizationId })
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const factory = (container.resolve('storageDriverFactory') as StorageDriverFactory | null) ?? new StorageDriverFactory(em)
  const driver = await factory.resolveForPartition(attachment.partitionCode, { tenantId: attachment.tenantId ?? '', organizationId: attachment.organizationId ?? '' })
  let buffer: Buffer
  try {
    buffer = (await driver.read(attachment.partitionCode, attachment.storagePath)).buffer
  } catch {
    return NextResponse.json({ error: 'File not available' }, { status: 404 })
  }
  const inline = canRenderInlineAttachment(attachment.mimeType)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Cache-Control': 'private, max-age=60',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Type': inline ? attachment.mimeType || 'application/octet-stream' : 'application/octet-stream',
      'Content-Disposition': buildAttachmentContentDisposition(attachment.fileName, inline ? 'inline' : 'attachment'),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'File on a public document link',
  methods: {
    GET: { summary: 'One file (bilty / e-way bill) of a dispatch link', tags: ['Dermat Orders'], query: querySchema, responses: [{ status: 200, description: 'File' }] },
  },
}

export { GET }
