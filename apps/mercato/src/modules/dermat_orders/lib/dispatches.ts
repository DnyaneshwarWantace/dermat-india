import { DermatOrder, DermatOrderLine, DermatOrderStage } from '../data/entities'
import { TaxInvoice } from '../../dermat_accounts/data/entities'
import { loadCustomers, type OrderContext } from './server'
import { priceOrder } from './pricing'

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const out = String(value).trim()
  return out || null
}

const COMING_STAGES: Record<string, string> = { packing: 'Packing', qc_qa: 'QC & QA release', billing: 'Billing' }

async function comingOrders(ctx: OrderContext, q?: string) {
  const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
  const open = await ctx.em.find(DermatOrderStage, { ...scope, stageKey: { $in: Object.keys(COMING_STAGES) }, status: { $in: ['open', 'on_hold'] } }, { limit: 500 })
  const orderIds = [...new Set(open.map((stage) => stage.orderId))]
  if (!orderIds.length) return []
  const [orders, lines, dispatchStages] = await Promise.all([
    ctx.em.find(DermatOrder, { id: { $in: orderIds }, ...scope, deletedAt: null, status: { $in: ['booked', 'confirmed'] } }),
    ctx.em.find(DermatOrderLine, { orderId: { $in: orderIds } }),
    ctx.em.find(DermatOrderStage, { orderId: { $in: orderIds }, stageKey: 'dispatch' }),
  ])
  const customers = await loadCustomers(ctx, orders.map((order) => order.customerId))
  const order = Object.keys(COMING_STAGES)
  let items = orders
    .filter((entry) => !dispatchStages.some((stage) => stage.orderId === entry.id && ['open', 'on_hold', 'done'].includes(stage.status)))
    .map((entry) => {
      const own = lines.filter((line) => line.orderId === entry.id)
      const stages = open.filter((stage) => stage.orderId === entry.id).sort((a, b) => order.indexOf(b.stageKey) - order.indexOf(a.stageKey))
      const value = priceOrder(own.map((line) => ({ quantity: Number(line.quantity), rate: line.rate == null ? null : Number(line.rate), gstPercent: Number(line.gstPercent ?? 18), discountPercent: Number(line.discountPercent ?? 0) })), entry.pricesIncludeGst).total
      return {
        orderId: entry.id,
        orderNo: entry.orderNo,
        customer: customers.get(entry.customerId)?.name ?? null,
        shippingAddress: entry.shippingAddress ?? null,
        priority: entry.priority,
        status: 'coming',
        atStage: stages.map((stage) => COMING_STAGES[stage.stageKey]).join(', '),
        onHold: stages.some((stage) => stage.status === 'on_hold'),
        deliveryDate: entry.deliveryDate ?? null,
        pieces: own.reduce((sum, line) => sum + Number(line.quantity), 0),
        value: Math.round(value * 100) / 100,
        invoices: [] as string[],
        dispatchDate: null,
        transporter: null,
        lrNumber: null,
        vehicleNo: null,
        ewayBillNo: null,
        packages: null,
        deliveredOn: null,
        ewayNeeded: value > 50000,
        waitingSince: null,
      }
    })
  const term = q?.trim().toLowerCase()
  if (term) items = items.filter((row) => [row.orderNo, row.customer].some((value) => (value ?? '').toLowerCase().includes(term)))
  items.sort((a, b) => (a.deliveryDate ?? '9999').localeCompare(b.deliveryDate ?? '9999'))
  return items
}

export async function dispatchRegister(ctx: OrderContext, filter: { view: 'coming' | 'ready' | 'done' | 'all'; q?: string; from?: string; to?: string }) {
  const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
  if (filter.view === 'coming') {
    const items = await comingOrders(ctx, filter.q)
    return { items, summary: { coming: items.length, ready: 0, dispatched: 0, awaitingDelivery: 0 } }
  }
  const statuses = filter.view === 'ready' ? ['open', 'on_hold'] : filter.view === 'done' ? ['done'] : ['open', 'on_hold', 'done']
  const stages = await ctx.em.find(DermatOrderStage, { ...scope, stageKey: 'dispatch', status: { $in: statuses } }, { orderBy: { updatedAt: 'desc' }, limit: 500 })
  const orderIds = [...new Set(stages.map((stage) => stage.orderId))]
  const coming = filter.view === 'all' ? (await comingOrders(ctx)).length : 0
  if (!orderIds.length) return { items: [], summary: { coming, ready: 0, dispatched: 0, awaitingDelivery: 0 } }
  const [orders, lines, invoices, billing] = await Promise.all([
    ctx.em.find(DermatOrder, { id: { $in: orderIds }, ...scope, deletedAt: null, status: { $ne: 'cancelled' } }),
    ctx.em.find(DermatOrderLine, { orderId: { $in: orderIds } }),
    ctx.em.find(TaxInvoice, { orderId: { $in: orderIds }, ...scope, deletedAt: null, status: 'issued', kind: 'invoice' }),
    ctx.em.find(DermatOrderStage, { orderId: { $in: orderIds }, stageKey: 'billing' }),
  ])
  const customers = await loadCustomers(ctx, orders.map((order) => order.customerId))
  let items = stages
    .map((stage) => {
      const order = orders.find((entry) => entry.id === stage.orderId)
      if (!order) return null
      const data = stage.data ?? {}
      const own = lines.filter((line) => line.orderId === order.id)
      const invoice = invoices.filter((entry) => entry.orderId === order.id).map((entry) => entry.code)
      const billData = billing.find((entry) => entry.orderId === order.id)?.data ?? {}
      const value = priceOrder(own.map((line) => ({ quantity: Number(line.quantity), rate: line.rate == null ? null : Number(line.rate), gstPercent: Number(line.gstPercent ?? 18), discountPercent: Number(line.discountPercent ?? 0) })), order.pricesIncludeGst).total
      return {
        orderId: order.id,
        orderNo: order.orderNo,
        customer: customers.get(order.customerId)?.name ?? null,
        shippingAddress: order.shippingAddress ?? null,
        priority: order.priority,
        status: stage.status,
        pieces: own.reduce((sum, line) => sum + Number(line.quantity), 0),
        value: Math.round(value * 100) / 100,
        invoices: invoice.length ? invoice : text(billData.invoice_number) ? [String(billData.invoice_number)] : [],
        dispatchDate: text(data.dispatch_date),
        transporter: text(data.transporter),
        lrNumber: text(data.lr_number),
        vehicleNo: text(data.vehicle_no),
        ewayBillNo: text(data.eway_bill_no),
        packages: text(data.packages),
        deliveredOn: text(data.delivered_on),
        ewayNeeded: value > 50000,
        waitingSince: stage.openedAt ? stage.openedAt.toISOString() : null,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
  const summary = {
    coming,
    ready: items.filter((row) => row.status !== 'done').length,
    dispatched: items.filter((row) => row.status === 'done').length,
    awaitingDelivery: items.filter((row) => row.status === 'done' && !row.deliveredOn).length,
  }
  const term = filter.q?.trim().toLowerCase()
  if (term) items = items.filter((row) => [row.orderNo, row.customer, row.transporter, row.lrNumber, row.vehicleNo, row.ewayBillNo, ...row.invoices].some((value) => (value ?? '').toLowerCase().includes(term)))
  if (filter.from) items = items.filter((row) => !row.dispatchDate || row.dispatchDate >= (filter.from as string))
  if (filter.to) items = items.filter((row) => !row.dispatchDate || row.dispatchDate <= (filter.to as string))
  items.sort((a, b) => (b.dispatchDate ?? '9999').localeCompare(a.dispatchDate ?? '9999'))
  return { items, summary }
}
