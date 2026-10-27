import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { isValidPhoneNumber } from '@open-mercato/shared/lib/phone'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { listPeople, resolveOrderContext } from '../../../dermat_orders/lib/server'
import { WhatsappNumber } from '../../data/entities'
import { WHATSAPP_ENV, sendWhatsapp, whatsappReady, whatsappSettings } from '../../lib/whatsapp'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['auth.acl.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['auth.acl.manage'] },
  POST: { requireAuth: true, requireFeatures: ['auth.acl.manage'] },
}

const saveSchema = z.object({ userId: z.string().uuid(), phone: z.string().trim().max(30), enabled: z.boolean().default(true) })
const testSchema = z.object({ userId: z.string().uuid() })

type Ctx = Exclude<Awaited<ReturnType<typeof resolveOrderContext>>, { error: string }>

async function guarded(ctx: Ctx, req: Request, resourceId: string, payload: Record<string, unknown>, run: () => Promise<Response>): Promise<Response> {
  const guard = await runRouteMutationGuards({
    container: ctx.container,
    req,
    auth: { userId: ctx.userId ?? 'system', tenantId: ctx.tenantId, organizationId: ctx.organizationId },
    input: { resourceKind: 'dermat_departments.whatsapp', resourceId, operation: 'custom', mutationPayload: payload },
  })
  if (!guard.ok) return guard.response
  const result = await run()
  await guard.runAfterSuccess()
  return result
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const [people, numbers] = await Promise.all([listPeople(ctx), ctx.em.find(WhatsappNumber, { tenantId: ctx.tenantId })])
  const settings = whatsappSettings()
  return NextResponse.json({
    ready: whatsappReady(),
    missing: WHATSAPP_ENV.filter((name) => !process.env[name]?.trim()),
    template: settings.template,
    language: settings.language,
    items: people.map((person) => {
      const row = numbers.find((entry) => entry.userId === person.id)
      return {
        userId: person.id,
        name: person.name,
        phone: row?.phone ?? null,
        enabled: row?.enabled ?? false,
        sentCount: row?.sentCount ?? 0,
        lastSentAt: row?.lastSentAt ? row.lastSentAt.toISOString() : null,
        lastError: row?.lastError ?? null,
      }
    }),
  })
}

async function PUT(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = saveSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Pick a person and a number' }, { status: 400 })
  const { userId, phone, enabled } = parsed.data
  if (phone && !isValidPhoneNumber(phone)) return NextResponse.json({ error: 'Write the number with the country code, e.g. +91 98200 00000' }, { status: 400 })
  if (!(await listPeople(ctx)).some((person) => person.id === userId)) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  return guarded(ctx, req, userId, parsed.data, async () => {
    const row = await ctx.em.findOne(WhatsappNumber, { tenantId: ctx.tenantId, userId })
    if (!phone) {
      if (row) await ctx.em.remove(row).flush()
      return NextResponse.json({ ok: true })
    }
    if (row) {
      row.phone = phone
      row.enabled = enabled
      row.lastError = null
    } else {
      ctx.em.persist(ctx.em.create(WhatsappNumber, { tenantId: ctx.tenantId, organizationId: ctx.organizationId, userId, phone, enabled }))
    }
    await ctx.em.flush()
    return NextResponse.json({ ok: true })
  })
}

async function POST(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = testSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Pick a person' }, { status: 400 })
  if (!whatsappReady()) return NextResponse.json({ error: 'WhatsApp is not set up yet' }, { status: 409 })
  const row = await ctx.em.findOne(WhatsappNumber, { tenantId: ctx.tenantId, userId: parsed.data.userId })
  if (!row) return NextResponse.json({ error: 'Save a number for this person first' }, { status: 400 })
  return guarded(ctx, req, row.userId, parsed.data, async () => {
    const result = await sendWhatsapp(row.phone, { title: 'Test message from Dermat India ERP', body: 'WhatsApp alerts are working for you.', link: '/backend/my-work' })
    row.lastSentAt = new Date()
    row.lastError = result.ok ? null : result.error.slice(0, 400)
    if (result.ok) row.sentCount += 1
    await ctx.em.flush()
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 502 })
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Departments',
  summary: 'WhatsApp alerts',
  methods: {
    GET: { summary: 'Whether WhatsApp is set up and each person’s number', tags: ['Dermat Departments'], responses: [{ status: 200, description: 'Status and people', schema: z.object({ ready: z.boolean() }).passthrough() }] },
    PUT: { summary: 'Save, switch off or remove a person’s WhatsApp number', tags: ['Dermat Departments'], requestBody: { schema: saveSchema }, responses: [{ status: 200, description: 'Saved', schema: z.object({ ok: z.boolean() }) }] },
    POST: { summary: 'Send a test WhatsApp to a person', tags: ['Dermat Departments'], requestBody: { schema: testSchema }, responses: [{ status: 200, description: 'Sent', schema: z.object({ ok: z.boolean() }) }] },
  },
}

export { GET, PUT, POST }
