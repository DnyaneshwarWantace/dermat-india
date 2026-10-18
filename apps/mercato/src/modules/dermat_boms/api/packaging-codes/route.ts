import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { enforceCommandOptimisticLock } from '@open-mercato/shared/lib/crud/optimistic-lock-command'
import { PackagingCode } from '../../data/entities'
import { packagingCodeInputSchema, packagingCodeQuerySchema, packagingCodeUpdateSchema } from '../../data/validators'
import { resolveBomContext } from '../../lib/server'
import { bomErrorResponse, runGuarded } from '../../lib/guard'
import { applyInput, assertCodeFree, findPackagingCode, normalizeCode, serializePackagingCodes, validateParts } from '../../lib/packaging'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_boms.view'] },
  POST: { requireAuth: true, requireFeatures: ['dermat_boms.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['dermat_boms.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['dermat_boms.manage'] },
}

const RESOURCE_KIND = 'dermat_boms.packaging_code'

async function GET(req: Request) {
  const ctx = await resolveBomContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const query = packagingCodeQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!query.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const { id, code, search, page, pageSize } = query.data
  try {
    if (id) {
      const [view] = await serializePackagingCodes(ctx, [await findPackagingCode(ctx, id)])
      return NextResponse.json(view)
    }
    const where: string[] = ['tenant_id = ?', 'organization_id = ?', 'deleted_at is null']
    const params: unknown[] = [ctx.tenantId, ctx.organizationId]
    if (code) {
      where.push(`upper(regexp_replace(code, '\\s+', ' ', 'g')) = ?`)
      params.push(normalizeCode(code))
    }
    if (search) {
      const term = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
      const compact = `%${search.replace(/[\s-]+/g, '').replace(/[\\%_]/g, (char) => `\\${char}`)}%`
      where.push(`(name ilike ? or code ilike ? or regexp_replace(code, '[\\s-]+', '', 'g') ilike ? or coalesce(size, '') ilike ?)`)
      params.push(term, term, compact, term)
    }
    const connection = ctx.em.getConnection()
    const [countRow] = await connection.execute<Array<{ total: string }>>(`select count(*) as total from dermat_packaging_codes where ${where.join(' and ')}`, params)
    const idRows = await connection.execute<Array<{ id: string }>>(
      `select id from dermat_packaging_codes where ${where.join(' and ')} order by code asc limit ? offset ?`,
      [...params, pageSize, (page - 1) * pageSize],
    )
    const rows = idRows.length ? await ctx.em.find(PackagingCode, { id: { $in: idRows.map((row) => row.id) } }, { orderBy: { code: 'asc' } }) : []
    const total = Number(countRow?.total ?? 0)
    return NextResponse.json({ items: await serializePackagingCodes(ctx, rows), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  } catch (error) {
    return bomErrorResponse(error)
  }
}

async function POST(req: Request) {
  const ctx = await resolveBomContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = packagingCodeInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid packaging code', details: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data
  try {
    await assertCodeFree(ctx, input.code)
    await validateParts(ctx, input)
    return await runGuarded(ctx, req, { resourceId: normalizeCode(input.code), operation: 'create', payload: input, resourceKind: RESOURCE_KIND }, async () => {
      const row = ctx.em.create(PackagingCode, { organizationId: ctx.organizationId, tenantId: ctx.tenantId, code: '', name: '', kind: input.kind })
      applyInput(row, input)
      ctx.em.persist(row)
      await ctx.em.flush()
      return NextResponse.json({ id: row.id, code: row.code }, { status: 201 })
    })
  } catch (error) {
    return bomErrorResponse(error)
  }
}

async function PUT(req: Request) {
  const ctx = await resolveBomContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = packagingCodeUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid packaging code', details: parsed.error.flatten() }, { status: 400 })
  const input = parsed.data
  try {
    const row = await findPackagingCode(ctx, input.id)
    enforceCommandOptimisticLock({ resourceKind: RESOURCE_KIND, resourceId: row.id, current: row.updatedAt, request: req })
    await assertCodeFree(ctx, input.code, row.id)
    await validateParts(ctx, input)
    return await runGuarded(ctx, req, { resourceId: row.id, operation: 'update', payload: input, resourceKind: RESOURCE_KIND }, async () => {
      applyInput(row, input)
      row.updatedAt = new Date()
      await ctx.em.flush()
      return NextResponse.json({ ok: true })
    })
  } catch (error) {
    return bomErrorResponse(error)
  }
}

async function DELETE(req: Request) {
  const ctx = await resolveBomContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const id = z.string().uuid().safeParse(new URL(req.url).searchParams.get('id'))
  if (!id.success) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  try {
    const row = await findPackagingCode(ctx, id.data)
    enforceCommandOptimisticLock({ resourceKind: RESOURCE_KIND, resourceId: row.id, current: row.updatedAt, request: req })
    return await runGuarded(ctx, req, { resourceId: row.id, operation: 'delete', payload: { id: row.id }, resourceKind: RESOURCE_KIND }, async () => {
      row.deletedAt = new Date()
      await ctx.em.flush()
      return NextResponse.json({ ok: true })
    })
  } catch (error) {
    return bomErrorResponse(error)
  }
}

const viewSchema = z.object({ id: z.string(), code: z.string(), name: z.string() }).passthrough()

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat BOM',
  summary: 'Packaging codes: a code (e.g. CT 11) and the set of packing parts it brings',
  methods: {
    GET: {
      summary: 'List packaging codes, or read one (id)',
      tags: ['Dermat BOM'],
      query: packagingCodeQuerySchema,
      responses: [{ status: 200, description: 'Packaging codes', schema: z.object({ items: z.array(viewSchema).optional() }).passthrough() }],
    },
    POST: {
      summary: 'Create a packaging code',
      tags: ['Dermat BOM'],
      requestBody: { schema: packagingCodeInputSchema },
      responses: [{ status: 201, description: 'Created', schema: z.object({ id: z.string(), code: z.string() }) }],
      errors: [{ status: 409, description: 'Code already exists' }],
    },
    PUT: {
      summary: 'Update a packaging code',
      tags: ['Dermat BOM'],
      requestBody: { schema: packagingCodeUpdateSchema },
      responses: [{ status: 200, description: 'Saved', schema: z.object({ ok: z.boolean() }) }],
      errors: [{ status: 409, description: 'Code already exists, or changed by someone else' }],
    },
    DELETE: {
      summary: 'Delete a packaging code',
      tags: ['Dermat BOM'],
      responses: [{ status: 200, description: 'Deleted', schema: z.object({ ok: z.boolean() }) }],
    },
  },
}

export { GET, POST, PUT, DELETE }
