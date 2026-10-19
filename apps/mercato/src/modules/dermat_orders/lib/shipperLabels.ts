import { randomBytes } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { DermatOrder, DermatOrderLine, DermatOrderStage } from '../data/entities'
import { OrderError, loadProducts, type OrderContext } from './server'

export type ShipmentInfo = {
  orderNo: string
  batchNo: string | null
  mfgDate: string | null
  mfgMonth: string | null
  expiryMonth: string | null
  packedQty: number | null
  products: Array<{ title: string; brandName: string | null; packSize: string | null; quantity: number }>
}

async function shipmentInfo(em: EntityManager, scope: { tenantId: string; organizationId: string }, order: DermatOrder): Promise<ShipmentInfo> {
  const [lines, stages] = await Promise.all([
    em.find(DermatOrderLine, { orderId: order.id }, { orderBy: { position: 'asc' } }),
    em.find(DermatOrderStage, { orderId: order.id, stageKey: { $in: ['manufacturing', 'packing'] } }),
  ])
  const products = await loadProducts({ em, ...scope } as unknown as OrderContext, lines.map((line) => line.productId))
  const manufacturing = stages.find((stage) => stage.stageKey === 'manufacturing')
  const packing = stages.find((stage) => stage.stageKey === 'packing')
  const specs = (lines[0]?.specs ?? {}) as Record<string, Record<string, string>>
  const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() || null : null)
  return {
    orderNo: order.orderNo,
    batchNo: text(manufacturing?.data?.batch_no) ?? lines[0]?.batchNo ?? null,
    mfgDate: text(manufacturing?.data?.mfg_date),
    mfgMonth: text(specs.production?.mfg_month),
    expiryMonth: text(specs.production?.expiry_month),
    packedQty: packing?.data?.packed_qty === undefined || packing?.data?.packed_qty === null || packing?.data?.packed_qty === '' ? null : Number(packing.data.packed_qty),
    products: lines.map((line) => ({ title: products.get(line.productId)?.title ?? '', brandName: line.brandName ?? null, packSize: line.packSize ?? null, quantity: Number(line.quantity) })),
  }
}

export async function labelData(ctx: OrderContext, order: DermatOrder): Promise<ShipmentInfo & { token: string }> {
  const packing = await ctx.em.findOne(DermatOrderStage, { orderId: order.id, stageKey: 'packing' })
  if (!packing) throw new OrderError('Packing stage not found', 404)
  let token = typeof packing.data?.__scan_token === 'string' ? packing.data.__scan_token : ''
  if (!token) {
    token = randomBytes(18).toString('base64url')
    packing.data = { ...(packing.data ?? {}), __scan_token: token }
    await ctx.em.flush()
  }
  return { token, ...(await shipmentInfo(ctx.em, ctx, order)) }
}

export async function scanData(em: EntityManager, token: string): Promise<ShipmentInfo> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) throw new OrderError('This label is not known', 404)
  const [row] = await em.getConnection().execute<Array<{ order_id: string; tenant_id: string; organization_id: string }>>(
    `select order_id, tenant_id, organization_id from dermat_order_stages where stage_key = 'packing' and data->>'__scan_token' = ? limit 1`,
    [token],
  )
  if (!row) throw new OrderError('This label is not known', 404)
  const order = await em.findOne(DermatOrder, { id: row.order_id, tenantId: row.tenant_id, organizationId: row.organization_id, deletedAt: null })
  if (!order) throw new OrderError('This label is not known', 404)
  return shipmentInfo(em, { tenantId: row.tenant_id, organizationId: row.organization_id }, order)
}
