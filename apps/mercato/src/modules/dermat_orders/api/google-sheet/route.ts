import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { resolveOrderContext } from '../../lib/server'
import { GOOGLE_ENV, googleCredentials, readSheetSetting, sheetIdFrom, syncGoogleSheet, writeSheetSetting } from '../../lib/googleSheet'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_orders.settings'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_orders.settings'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_orders.settings'] },
}

const saveSchema = z.object({ sheet: z.string().trim().max(300) })

type Ctx = Exclude<Awaited<ReturnType<typeof resolveOrderContext>>, { error: string }>

async function guarded(ctx: Ctx, req: Request, payload: Record<string, unknown>, run: () => Promise<Response>): Promise<Response> {
  const guard = await runRouteMutationGuards({
    container: ctx.container,
    req,
    auth: { userId: ctx.userId ?? 'system', tenantId: ctx.tenantId, organizationId: ctx.organizationId },
    input: { resourceKind: 'dermat_orders.google_sheet', resourceId: ctx.tenantId, operation: 'custom', mutationPayload: payload },
  })
  if (!guard.ok) return guard.response
  const result = await run()
  await guard.runAfterSuccess()
  return result
}

async function status(ctx: Ctx) {
  const setting = await readSheetSetting(ctx)
  const credentials = googleCredentials()
  return {
    ready: Boolean(credentials),
    missing: GOOGLE_ENV.filter((name) => !process.env[name]?.trim()),
    shareWith: credentials?.email ?? null,
    sheetUrl: setting.sheetId ? `https://docs.google.com/spreadsheets/d/${setting.sheetId}/edit` : null,
    lastSyncAt: setting.lastSyncAt,
    rows: setting.rows,
    error: setting.error,
  }
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  return NextResponse.json(await status(ctx))
}

async function PUT(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = saveSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Paste the Google Sheet link' }, { status: 400 })
  const sheetId = parsed.data.sheet ? sheetIdFrom(parsed.data.sheet) : null
  if (parsed.data.sheet && !sheetId) return NextResponse.json({ error: 'That does not look like a Google Sheet link' }, { status: 400 })
  return guarded(ctx, req, parsed.data, async () => {
    const setting = await readSheetSetting(ctx)
    await writeSheetSetting(ctx, { ...setting, sheetId, error: null, ...(sheetId !== setting.sheetId ? { lastSyncAt: null, rows: null } : {}) })
    return NextResponse.json(await status(ctx))
  })
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  return guarded(ctx, req, {}, async () => {
    try {
      await syncGoogleSheet(ctx)
      return NextResponse.json(await status(ctx))
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Sync failed' }, { status: 502 })
    }
  })
}

const view = z.object({ ready: z.boolean() }).passthrough()

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Orders',
  summary: 'Order book on a Google Sheet',
  methods: {
    GET: { summary: 'Whether the Google Sheet link is set up and when it was last written', tags: ['Dermat Orders'], responses: [{ status: 200, description: 'Status', schema: view }] },
    PUT: { summary: 'Save (or clear) the Google Sheet link', tags: ['Dermat Orders'], requestBody: { schema: saveSchema }, responses: [{ status: 200, description: 'Saved', schema: view }] },
    POST: { summary: 'Write the order book to the Google Sheet now', tags: ['Dermat Orders'], responses: [{ status: 200, description: 'Written', schema: view }] },
  },
}

export { GET, PUT, POST }
