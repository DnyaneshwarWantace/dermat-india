import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { loadCustomers, resolveOrderContext } from '../../../dermat_orders/lib/server'
import { OrderPayment, SampleCharge } from '../../data/entities'
import { receiptsQuerySchema } from '../../data/validators'
import { paymentView } from '../../lib/service'
import { sampleChargeView } from '../../lib/sampleCharges'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dermat_accounts.view'] },
}

async function GET(req: Request) {
  const ctx = await resolveOrderContext(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const parsed = receiptsQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  const query = parsed.data
  const where: string[] = ['p.tenant_id = ?', 'p.organization_id = ?']
  const params: unknown[] = [ctx.tenantId, ctx.organizationId]
  const sWhere: string[] = ['s.tenant_id = ?', 's.organization_id = ?']
  const sParams: unknown[] = [ctx.tenantId, ctx.organizationId]
  if (query.includeVoided === '0') {
    where.push('p.voided_at is null')
    sWhere.push('s.voided_at is null')
  }
  if (query.from) {
    where.push('p.paid_on >= ?')
    params.push(query.from)
    sWhere.push('s.paid_on >= ?')
    sParams.push(query.from)
  }
  if (query.to) {
    where.push('p.paid_on <= ?')
    params.push(query.to)
    sWhere.push('s.paid_on <= ?')
    sParams.push(query.to)
  }
  if (query.mode) {
    where.push('p.mode = ?')
    params.push(query.mode)
    sWhere.push('s.mode = ?')
    sParams.push(query.mode)
  }
  if (query.customerId) {
    where.push('o.customer_id = ?')
    params.push(query.customerId)
    sWhere.push('s.customer_id = ?')
    sParams.push(query.customerId)
  }
  if (query.search) {
    const term = `%${query.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
    where.push('(p.order_no ilike ? or p.reference ilike ? or p.invoice_code ilike ?)')
    params.push(term, term, term)
    sWhere.push('(s.rd_code ilike ? or s.reference ilike ?)')
    sParams.push(term, term)
  }
  const union = `select p.id, 'order' as source, o.customer_id, p.paid_on, p.created_at, p.amount, p.voided_at from dermat_order_payments p join dermat_orders o on o.id = p.order_id where ${where.join(' and ')}
    union all
    select s.id, 'sample' as source, s.customer_id, s.paid_on, s.created_at, s.amount, s.voided_at from dermat_sample_charges s where ${sWhere.join(' and ')}`
  const allParams = [...params, ...sParams]
  const connection = ctx.em.getConnection()
  const [agg] = await connection.execute<Array<{ total: string; amount: string | null }>>(`select count(*) as total, sum(case when r.voided_at is null then r.amount else 0 end) as amount from (${union}) r`, allParams)
  const rows = await connection.execute<Array<{ id: string; source: string; customer_id: string }>>(`select r.id, r.source, r.customer_id from (${union}) r order by r.paid_on desc, r.created_at desc limit ? offset ?`, [...allParams, query.pageSize, (query.page - 1) * query.pageSize])
  const orderIds = rows.filter((row) => row.source === 'order').map((row) => row.id)
  const sampleIds = rows.filter((row) => row.source === 'sample').map((row) => row.id)
  const [payments, samples] = await Promise.all([
    orderIds.length ? ctx.em.find(OrderPayment, { id: { $in: orderIds } }) : Promise.resolve([] as OrderPayment[]),
    sampleIds.length ? ctx.em.find(SampleCharge, { id: { $in: sampleIds } }) : Promise.resolve([] as SampleCharge[]),
  ])
  const customers = await loadCustomers(ctx, rows.map((row) => row.customer_id))
  const total = Number(agg?.total ?? 0)
  return NextResponse.json({
    items: rows
      .map((row) => {
        const customer = { customerId: row.customer_id, customerName: customers.get(row.customer_id)?.name ?? '' }
        if (row.source === 'sample') {
          const charge = samples.find((entry) => entry.id === row.id)
          return charge ? { ...sampleChargeView(charge), orderId: null, orderNo: charge.rdCode ?? '', invoiceId: null, invoiceCode: null, history: [], ...customer } : null
        }
        const payment = payments.find((entry) => entry.id === row.id)
        return payment ? { ...paymentView(payment), ...customer } : null
      })
      .filter(Boolean),
    total,
    amount: Math.round(Number(agg?.amount ?? 0) * 100) / 100,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Dermat Accounts',
  summary: 'All payments received',
  methods: {
    GET: { summary: 'Receipts across orders (newest first) with customer, filters and the sum', tags: ['Dermat Accounts'], query: receiptsQuerySchema, responses: [{ status: 200, description: 'Receipts', schema: z.object({}).passthrough() }] },
  },
}

export { GET }
