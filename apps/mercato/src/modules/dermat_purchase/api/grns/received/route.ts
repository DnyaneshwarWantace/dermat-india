import { NextResponse } from 'next/server'
import { withSupplierMask } from '../../../../dermat_products/lib/suppliers'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { hasFeatures, resolveOrderContext } from '../../../../dermat_orders/lib/server'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['catalog.products.view'] },
}

const querySchema = z.object({ productId: z.string().uuid() })

const rowSchema = z.object({
  grnId: z.string(),
  code: z.string(),
  date: z.string(),
  vendorName: z.string().nullable(),
  poCode: z.string().nullable(),
  invoiceNo: z.string().nullable(),
  quantity: z.number(),
  unit: z.string().nullable(),
  lotNumber: z.string().nullable(),
  rate: z.number().nullable(),
  files: z.number(),
})

async function getUnmasked(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  const rows = await ctx.em.getConnection().execute<
    Array<{ grn_id: string; code: string; grn_date: string; vendor_name: string | null; po_code: string | null; invoice_no: string | null; quantity: string; unit: string | null; lot_number: string | null; rate: string | null; files: string | number }>
  >(
    `select g.id as grn_id, g.code, g.grn_date, g.vendor_name, g.po_code, g.invoice_no, l.quantity, l.unit, l.lot_number, l.rate,
            (select count(*) from attachments a where a.entity_id = 'dermat_purchase:grn' and a.record_id = g.id::text and a.tenant_id = g.tenant_id) as files
       from dermat_grn_lines l
       join dermat_grns g on g.id = l.grn_id and g.deleted_at is null
      where l.product_id = ? and g.tenant_id = ? and g.organization_id = ?
      order by g.grn_date desc, g.created_at desc
      limit 50`,
    [parsed.data.productId, ctx.tenantId, ctx.organizationId],
  )
  const [seeVendor, seeRate] = await Promise.all([
    (async () => (await hasFeatures(ctx, ['dermat_products.supplier'])) || hasFeatures(ctx, ['dermat_purchase.view']))(),
    hasFeatures(ctx, ['dermat_purchase.view']),
  ])
  return NextResponse.json({
    canSeeVendor: seeVendor,
    items: rows.map((row) => ({
      grnId: row.grn_id,
      code: row.code,
      date: row.grn_date,
      vendorName: seeVendor ? row.vendor_name : null,
      poCode: row.po_code,
      invoiceNo: row.invoice_no,
      quantity: Number(row.quantity),
      unit: row.unit,
      lotNumber: row.lot_number,
      rate: seeRate && row.rate != null ? Number(row.rate) : null,
      files: Number(row.files),
    })),
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Purchase',
  summary: 'Where a material came from',
  methods: {
    GET: {
      summary: 'Every goods receipt of a product: date, vendor (with permission), PO, invoice, lot and attached files',
      tags: ['Dermat Purchase'],
      query: querySchema,
      responses: [{ status: 200, description: 'Receipts', schema: z.object({ items: z.array(rowSchema), canSeeVendor: z.boolean() }) }],
    },
  },
}

const GET = withSupplierMask(getUnmasked)

export { GET }
