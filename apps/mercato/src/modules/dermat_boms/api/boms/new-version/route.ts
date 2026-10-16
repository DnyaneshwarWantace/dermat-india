import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { BomHeader, BomItem } from '../../../data/entities'
import { bomActionSchema } from '../../../data/validators'
import { findBom } from '../../../lib/service'
import { currentUserName, nextBomCode, resolveBomContext } from '../../../lib/server'
import { bomErrorResponse, runGuarded } from '../../../lib/guard'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['dermat_boms.manage'] },
}

const bodySchema = bomActionSchema.pick({ id: true }).extend({ name: z.string().trim().max(200).optional().nullable() })

async function POST(req: Request) {
  const ctx = await resolveBomContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  try {
    const source = await findBom(ctx, parsed.data.id)
    const latest = await ctx.em.findOne(
      BomHeader,
      { productId: source.productId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, deletedAt: null },
      { orderBy: { version: 'desc' } },
    )
    return await runGuarded(ctx, req, { resourceId: source.id, operation: 'custom', payload: parsed.data }, async () => {
      const createdByName = await currentUserName(ctx)
      const created = await ctx.em.transactional(async (em) => {
        const txCtx = { ...ctx, em: em as EntityManager }
        const header = em.create(BomHeader, {
          organizationId: ctx.organizationId,
          tenantId: ctx.tenantId,
          code: await nextBomCode(txCtx),
          name: parsed.data.name?.trim() || source.name || null,
          productId: source.productId,
          productKind: source.productKind,
          orderId: source.orderId ?? null,
          orderNo: source.orderNo ?? null,
          version: (latest?.version ?? source.version) + 1,
          status: 'draft',
          batchSize: source.batchSize,
          batchUnit: source.batchUnit,
          yieldPercent: source.yieldPercent,
          notes: source.notes ?? null,
          createdByName,
        })
        em.persist(header)
        await em.flush()
        const items = await em.find(BomItem, { bomId: source.id }, { orderBy: { position: 'asc' } })
        for (const item of items) {
          em.persist(
            em.create(BomItem, {
              organizationId: ctx.organizationId,
              tenantId: ctx.tenantId,
              bomId: header.id,
              position: item.position,
              componentProductId: item.componentProductId,
              componentKind: item.componentKind,
              percent: item.percent ?? null,
              qtyPerUnit: item.qtyPerUnit ?? null,
              fillQty: item.fillQty ?? null,
              fillUnit: item.fillUnit ?? null,
              unit: item.unit,
              remark: item.remark ?? null,
            }),
          )
        }
        await em.flush()
        return header
      })
      return NextResponse.json({ id: created.id, code: created.code }, { status: 201 })
    })
  } catch (error) {
    return bomErrorResponse(error)
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat BOM',
  summary: 'Start a new version of a BOM',
  methods: {
    POST: {
      summary: 'Copy a BOM into a new draft (Copy BOM, or edit an approved BOM as a new version)',
      tags: ['Dermat BOM'],
      requestBody: { schema: bodySchema },
      responses: [{ status: 201, description: 'Draft created', schema: z.object({ id: z.string(), code: z.string() }) }],
    },
  },
}

export { POST }
